use actix::{Actor, StreamHandler, Handler, Message, AsyncContext, ActorContext};
use actix_web_actors::ws;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use crate::services::terminal::{TerminalService, TerminalMessage};

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

/// WebSocket terminal session
pub struct TerminalWsSession {
    /// Unique session id
    session_id: String,
    /// User ID
    user_id: String,
    /// Project ID
    project_id: String,
    /// Terminal service
    terminal_service: Arc<TerminalService>,
    /// Client must send ping at least once per CLIENT_TIMEOUT
    hb: Instant,
}

impl TerminalWsSession {
    pub fn new(
        session_id: String,
        user_id: String,
        project_id: String,
        terminal_service: Arc<TerminalService>,
    ) -> Self {
        Self {
            session_id,
            user_id,
            project_id,
            terminal_service,
            hb: Instant::now(),
        }
    }

    /// Heartbeat to check client connection
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                log::info!("WebSocket client heartbeat failed, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for TerminalWsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Start heartbeat
        self.hb(ctx);

        // Send ready message
        let ready = TerminalMessage::Ready;
        if let Ok(json) = serde_json::to_string(&ready) {
            ctx.text(json);
        }

        log::info!("Terminal WebSocket session started: {}", self.session_id);
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        log::info!("Terminal WebSocket session stopped: {}", self.session_id);
    }
}

/// Message for sending terminal output back to WebSocket
#[derive(Message)]
#[rtype(result = "()")]
pub struct TerminalOutput(pub TerminalMessage);

impl Handler<TerminalOutput> for TerminalWsSession {
    type Result = ();

    fn handle(&mut self, msg: TerminalOutput, ctx: &mut Self::Context) {
        if let Ok(json) = serde_json::to_string(&msg.0) {
            ctx.text(json);
        }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for TerminalWsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                self.hb = Instant::now();

                // Parse incoming message
                match serde_json::from_str::<TerminalMessage>(&text) {
                    Ok(TerminalMessage::Command { command, session_id: _, rpc_url }) => {
                        // Execute command
                        let service = self.terminal_service.clone();
                        let session_id = self.session_id.clone();
                        let user_id = self.user_id.clone();
                        let project_id = self.project_id.clone();
                        let addr = ctx.address();
                        let rpc = rpc_url.clone();

                        // Spawn async task to execute command
                        actix::spawn(async move {
                            let (tx, mut rx) = mpsc::channel::<TerminalMessage>(100);

                            // Start command execution in background
                            let cmd = command.clone();
                            // Move tx into the spawned task (don't clone - we want channel to close when done)
                            let exec_handle = tokio::spawn(async move {
                                if let Err(e) = service.execute_command(
                                    &session_id,
                                    &user_id,
                                    &project_id,
                                    &cmd,
                                    rpc.as_deref(),
                                    tx.clone(),
                                ).await {
                                    log::error!("Command execution error: {}", e);
                                    // Send error message to client
                                    let _ = tx.send(TerminalMessage::Error {
                                        message: e.to_string(),
                                    }).await;
                                    // Send exit with error code
                                    let _ = tx.send(TerminalMessage::Exit { code: 1 }).await;
                                }
                                // tx is dropped here when the task completes, closing the channel
                            });

                            // Forward output messages to WebSocket
                            // This loop exits when all senders (tx) are dropped
                            while let Some(msg) = rx.recv().await {
                                addr.do_send(TerminalOutput(msg));
                            }

                            let _ = exec_handle.await;
                        });
                    }
                    Ok(_) => {
                        // Ignore other message types from client
                    }
                    Err(e) => {
                        log::error!("Failed to parse terminal message: {}", e);
                        let error = TerminalMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        if let Ok(json) = serde_json::to_string(&error) {
                            ctx.text(json);
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                log::warn!("Binary messages not supported");
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                ctx.stop();
            }
            _ => (),
        }
    }
}
