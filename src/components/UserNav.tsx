import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Bug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth";
import { ProfileDialog } from "@/components/ProfileDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";

export function UserNav() {
  const { user, refreshUser } = useAuth();
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const handleReportIssue = () => {
    window.open(
      "https://github.com/tolgayayci/nearplay/issues/new?labels=bug&template=bug_report.md",
      "_blank"
    );
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={`https://avatar.vercel.sh/${user.email}`}
                alt={user.email}
              />
              <AvatarFallback>
                {user.email.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.name || user.email}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReportIssue}>
              <Bug className="mr-2 h-4 w-4" />
              Report Issue
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        user={user}
        onUserUpdate={() => refreshUser()}
      />
    </>
  );
}
