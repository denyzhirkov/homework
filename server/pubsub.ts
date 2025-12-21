// Pipeline-specific events
export type PipelineEvent = 
  | { type: "log"; pipelineId: string; payload: { runId: string; msg: string; ts: string } }
  | { type: "start"; pipelineId: string; payload: { runId: string } }
  | { type: "end"; pipelineId: string; payload: { runId: string; success: boolean } }
  | { type: "step-start"; pipelineId: string; payload: { runId: string; step: string } }
  | { type: "step-end"; pipelineId: string; payload: { runId: string; step: string; success: boolean; error?: string } };

// System-wide events
export type SystemEvent =
  | { type: "pipelines:changed" }  // Pipeline list changed (created/deleted)
  | { type: "modules:changed" }    // Modules list changed
  | { type: "variables:changed" }; // Variables changed

export type WSEvent = PipelineEvent | SystemEvent;

type Listener = (event: WSEvent) => void;

class PubSub {
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: WSEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export const pubsub = new PubSub();
