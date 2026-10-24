'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToastAction = React.ReactNode;

type ToastProps = {
  id: string;
  title?: string;
  description?: string;
  action?: ToastAction;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
};

type ToastState = {
  toasts: ToastProps[];
};

const toastTypes: Record<string, ToastProps['variant']> = {
  default: 'default',
  success: 'success',
  error: 'destructive',
};

const listeners: Array<(state: ToastState) => void> = [];

let count = 0;

function generateId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType['ADD_TOAST']; toast: ToastProps }
  | { type: ActionType['UPDATE_TOAST']; toast: Partial<ToastProps> }
  | { type: ActionType['DISMISS_TOAST']; toastId?: string }
  | { type: ActionType['REMOVE_TOAST']; toastId?: string };

interface State {
  toasts: ToastProps[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string, duration = TOAST_REMOVE_DELAY) => {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, duration);

  toastTimeouts.set(toastId, timeout);
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      addToRemoveQueue(action.toast.id, action.toast.duration);
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case 'DISMISS_TOAST': {
      const { toastId } = action;
      if (toastId) {
        const target = state.toasts.find((t) => t.id === toastId);
        addToRemoveQueue(toastId, target?.duration);
      } else {
        state.toasts.forEach((t) => addToRemoveQueue(t.id, t.duration));
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId ? { ...t } : t
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};

let store: State = { toasts: [] };

function dispatch(action: Action) {
  store = reducer(store, action);
  listeners.forEach((listener) => listener(store));
}

type ToastPropsExtended = Omit<ToastProps, 'id'> & {
  duration?: number;
};

export function toast({
  title,
  description,
  action,
  variant = 'default',
  duration,
}: ToastPropsExtended) {
  const id = generateId();
  const update = (toastProps: Partial<ToastProps>) =>
    dispatch({ type: 'UPDATE_TOAST', toast: { ...toastProps, id } });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      id,
      title,
      description,
      action,
      variant,
      ...(duration ? { duration } : {}),
    },
  });

  return { id, dismiss, update };
}

export function useToast() {
  const [state, setState] = React.useState<State>({ toasts: [] });

  React.useEffect(() => {
    setState({ toasts: [...store.toasts] });
    const listener = (s: State) => setState({ toasts: [...s.toasts] });
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([...store.toasts]);

  React.useEffect(() => {
    const listener = (s: State) => setToasts([...s.toasts]);
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-0 right-0 z-50 p-4 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastComponent {...t} />
        </div>
      ))}
    </div>
  );
}

type ToastComponentProps = ToastProps & {
  className?: string;
};

function ToastComponent({
  title,
  description,
  action,
  variant = 'default',
  className,
  // id and duration are toast state, not DOM attributes
  id: _id,
  duration: _duration,
  ...props
}: ToastComponentProps) {
  const variantConfig: Record<string, string> = {
    default: 'border border-border bg-background text-foreground',
    success: 'border border-accent bg-accent text-accent-foreground',
    destructive: 'border border-destructive bg-destructive text-destructive-foreground',
  };

  return (
    <div
      role={variant === 'destructive' ? 'alert' : undefined}
      aria-atomic="true"
      className={cn(
        'relative flex items-start gap-4 rounded-lg border p-4 shadow-lg w-full max-w-sm animate-toast-in',
        variantConfig[variant],
        className,
      )}
      {...props}
    >
      <div className="shrink-0">
        {variant === 'success' ? (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-accent-foreground text-accent">
            <svg aria-hidden="true" className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
            </svg>
          </div>
        ) : variant === 'destructive' ? (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <svg aria-hidden="true" className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h3a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg aria-hidden="true" className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {title && (
          <h4 className="font-semibold">{title}</h4>
        )}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
      {action && (
        <button
          className="ml-auto text-sm font-medium hover:underline"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export { ToastProvider };
