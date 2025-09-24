import { ABIMethod } from '@/lib/types';
import { ABIParameterTooltip } from './ABIParameterTooltip';

interface ABIMethodSignatureProps {
  method: ABIMethod;
}

export function ABIMethodSignature({ method }: ABIMethodSignatureProps) {
  // Handle NEAR ABI format where inputs might be undefined
  const inputs = method.inputs || [];
  const outputs = method.outputs || [];
  
  return (
    <div className="text-xs text-muted-foreground font-mono">
      {method.name || 'constructor'}(
      {inputs.map((input, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <ABIParameterTooltip parameter={input}>
            <span className="text-foreground">{input.type || 'unknown'}</span>
            {' '}
            <span className="text-muted-foreground">{input.name || ''}</span>
          </ABIParameterTooltip>
        </span>
      ))}
      )
      {outputs.length > 0 && (
        <>
          {' → '}
          {outputs.map((output, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <span className="text-foreground">{output.type || 'unknown'}</span>
            </span>
          ))}
        </>
      )}
    </div>
  );
}