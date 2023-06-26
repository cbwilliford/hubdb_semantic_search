import { Configuration, OpenAIApi }  from "openai";
import dotenv from 'dotenv';
dotenv.config();


const configuration = new Configuration({
    apiKey: process.env.OPENAI_KEY,
});


const openai = new OpenAIApi(configuration);


const input = process.argv[2];

if (!input) {
  console.log("You forgot to ask a question.");
  process.exit();
}


const getPrompt = (context, input) => {
  return `Answer the question using the provided context.
      If the answer is not contained within the text below, say "I'm unsure.".

      Context: ${context}

      Question: ${input}

      Answer: `;
}


const createEmbeddings = async (input) => {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_KEY}`,
    },
    method: 'POST',
    body: JSON.stringify({ input, model: "text-embedding-ada-002" }),
  });

  const {data} = await response.json();
  return data;
};



const queryPinecone = async (vector) => {

  try {
    const response = await fetch('https://hubvectordb-658345a.svc.asia-southeast1-gcp-free.pinecone.io/query', {
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.PINECONE_KEY,
    },
    method: 'POST',
    body: JSON.stringify({
      vector,
      topK: 10,
      includeMetadata: true,
      }),
    });

    const data = await response.json();
    return data.matches.map(match => match.metadata);
  }catch (error) {
    console.error('Error:', error);
  }

};



const embeddingResult = await createEmbeddings(input);

const {embedding} = embeddingResult[0];

const queryResults = await queryPinecone(embedding);

const context = queryResults.map(result => result.text).join(' ');

const prompt = getPrompt(context, input);

const chat_completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
});

console.log(chat_completion.data.choices[0].message.content)
