# NextComet v0.1.0

## Server Sent Events in NextJS w/Mongo

### Usage

0. `npm i nextcomet`

1. Create next api route:

```js
// app/api/SSE/route.tsdd
import longPoll, { poller, PollLogger } from "nextcomet";

export async function GET() {
  await MongooseConnect(); // connect to your DB

  // Define polling settings
  const pollSettings = {
    model: ChatModel, //<-- Mongoose Model

    //Event will run on DB insert
    insert: (notify: PollLogger, change: any) => {
      notify.log({
        tag: "insert", // <-- tag messages however you'd like for the frontend
        message: change.fullDocument.message,
        id: change.fullDocument._id,
      });
    },
    //Event will run on DB delete
    delete: (notify: PollLogger, change: any) => {
      notify.log({
        tag: "delete",
        message: "Chat deleted",
        id: change.documentKey._id,
      });
    },
  };

  const responseStream = new TransformStream();
  poller(responseStream, pollSettings);
  return longPoll(responseStream);
}
```

2. Use it in the frontend on a "use client" component:

```js
import { listenSSE } from "nextcomet";
interface ChatMessage {
  message: string;
  id: string;
}

// Begin listening for changes to the database
// handleNewMessage is a callback that receives the changes
// "/api/SSE" is the API resource we setup in step

const [messages, setMessages] = useState<ChatMessage[]>([]);

useEffect(() => {
  listenSSE(handleNewMessage, "/api/SSE");
}, []);

// our message handling callback
const handleNewMessage = (message: any) => {
  switch (message.tag) {
    case "insert": // <-- catch messages by tag defined in the API route
      setMessages((messages) => [...messages, message]);
      break;
    case "delete":
      console.log("Error: ", message);
      break;
  }
};
```

Done! You're now getting live updates from your Database
