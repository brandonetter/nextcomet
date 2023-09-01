const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Notify {
  log: (message: {
    message: string;
    id: string;
    tag: string;
    [key: string]: any;
  }) => void;
  complete: (data: any) => void;
  error: (error: Error | any) => void;
  close: () => void;
}
export type PollLogger = Notify;
export const listenSSE = (
  callback: (event: MessageEvent<any>) => { cancel?: true } | void,
  route: string
) => {
  const eventSource = new EventSource(route, {
    withCredentials: true,
  });
  eventSource.onmessage = (event) => {
    const result = callback(JSON.parse(event.data));
    if (result?.cancel) {
      eventSource.close();
    }
  };
  return {
    close: () => {
      eventSource.close();
    },
  };
};
export interface PollSettings {
  model: any;
  insert?: (notify: PollLogger, change: any) => void;
  delete?: (notify: PollLogger, change: any) => void;
  update?: (notify: PollLogger, change: any) => void;
  initial?: (notify: PollLogger) => void;
}
export async function poller(
  responseStream: TransformStream,
  pollSettings: PollSettings
) {
  const eventEmitter = pollSettings.model.watch();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();
  let closed = false;
  let initial = false;
  async function longPoller(notify: PollLogger) {
    if (!initial && pollSettings.initial) {
      pollSettings.initial(notify);
      initial = true;
    }

    eventEmitter.on("change", (change: any) => {
      if (change.operationType === "delete" && pollSettings.delete) {
        pollSettings.delete(notify, change);
      } else if (change.operationType === "insert" && pollSettings.insert) {
        pollSettings.insert(notify, change);
      } else if (change.operationType === "update" && pollSettings.update) {
        pollSettings.update(notify, change);
      }
    });

    while (true) {
      //   console.log(process.uptime());
      await delay(1000);
    }
  }
  longPoller({
    log: (msg: { message: string }) =>
      writer.write(encoder.encode("data: " + JSON.stringify(msg) + "\n\n")),
    complete: (obj: any) => {
      writer.write(encoder.encode("data: " + JSON.stringify(obj) + "\n\n"));
      if (!closed) {
        writer.close();
        closed = true;
      }
    },
    error: (err: Error | any) => {
      writer.write(encoder.encode("data: " + JSON.stringify(err) + "\n\n"));
      if (!closed) {
        writer.close();
        closed = true;
      }
    },
    close: () => {
      if (!closed) {
        writer.close();
        closed = true;
      }
    },
  })
    .then(() => {
      if (!closed) {
        writer.close();
      }
    })
    .catch(() => {
      if (!closed) {
        writer.close();
      }
    });
}

export default function longPoll(responseStream: TransformStream) {
  return new Response(responseStream.readable, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}
