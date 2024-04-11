// import { Configuration, OpenAIApi } from "openai";
import { withNextSession } from "@/lib/session";
import { dbConnect } from "@/lib/lowDb";
import bots from "./bots.json";

// const configuration = new Configuration({
//   apiKey: process.env.LAMINI_TOKEN,
// });
const apiKey = process.env.LAMINI_TOKEN;

const AI_RESPONSE =
  "```js\nimport React from 'react';\n\nconst MyComponent = () => {\n  return <div>I'm a simple component!</div>;\n};\n\nexport default MyComponent;\n```\n\nThis example is a basic React component. It imports the React library, defines a component function, and returns a DOM element. Finally, the component is exported so it can be imported and used in other components.";

const USER_NAME = "User";
const AI_NAME = "Assitant"; //"Walt"
const MEMORY_SIZE = 6;

export default withNextSession(async (req, res) => {
  if (req.method === "POST") {
    const { stack } = req.query;
    const body = req.body;
    const prompt = body.prompt || "";
    const { user } = req.session;

    if (!apiKey) {
      //(!configuration.apiKey) {
      return res
        .status(500)
        .json({ error: { message: "LAMINI Api Key is missing!" } });
    }

    if (!user) {
      return res
        .status(500)
        .json({ error: { message: "Session is missing!" } });
    }

    // await new Promise((res) => setTimeout(res, 500));
    // return res.status(200).json({result: AI_RESPONSE});

    try {
      let aiResponse = "This is a test response";
      const db = await dbConnect();

      db.data.messageHistory[user.uid] ||= [];
      db.data.messageHistory[user.uid].push(`${USER_NAME}: ${prompt}\n`);

      const aiPrompt = bots[stack].prompt;
      // const openai = new OpenAIApi(configuration);
      // const completion = await openai.createCompletion({
      //   model: "text-davinci-003",
      //   prompt: aiPrompt + db.data.messageHistory[user.uid].join("") + "Walt:",
      //   temperature: 0.7,
      //   max_tokens: 1024
      // });

      // const aiResponse = (completion.data.choices[0].text).trim();
      const url = "https://api.lamini.ai/v1/completions";
      const requestData = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_name: "meta-llama/Llama-2-7b-chat-hf",
          // prompt: "What is a llama?",
          prompt:
            aiPrompt + db.data.messageHistory[user.uid].join("") + "Assistant:",
        }),
      };
      await fetch(url, requestData)
        .then((response) => response.json())
        .then((data) => {
          console.log(data.output);
          aiResponse = data.output;
        })
        .catch((error) => console.error("Error:", error));

      const searchString = "USER:";
      const index = aiResponse.indexOf(searchString);
      if (index !== -1) {
        aiResponse = aiResponse.substring(0, index);
      }

      db.data.messageHistory[user.uid].push(`${AI_NAME}: ${aiResponse}\n`);

      if (db.data.messageHistory[user.uid].length > MEMORY_SIZE) {
        db.data.messageHistory[user.uid].splice(0, 2);
      }

      return res.status(200).json({ result: aiResponse });
    } catch (e) {
      console.log(e.message);
      return res.status(500).json({ error: { message: e.message } });
    }
  } else if (req.method === "PUT") {
    const { uid } = req.query;

    if (!uid) {
      return res
        .status(500)
        .json({ error: { message: "Invalid uid provided!" } });
    }

    req.session.user = {
      uid,
    };

    await req.session.save();

    return res.status(200).json(uid);
  } else if (req.method === "DELETE") {
    const { user } = req.session;

    if (user) {
      const db = await dbConnect();
      db.data.messageHistory[user.uid] = [];

      return res.status(200).json({ message: "History cleared!" });
    }

    return res.status(200).json({ message: "Nothing to clear!" });
  } else {
    return res.status(500).json({ error: { message: "Invalid Api Route" } });
  }
});
