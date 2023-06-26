import { PineconeClient } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';
dotenv.config();

const pinecone = new PineconeClient();

await pinecone.init({
  environment: process.env.PINECONE_ENV,
  apiKey: process.env.PINECONE_KEY,
});


const tableId = "6637605"
const portalId = "5004811"

const hubdbToText = async (tableId, portalId) => {

  const reqUrl = `https://api.hubapi.com/cms/v3/hubdb/tables/${tableId}/rows?portalId=${portalId}`;
  const rowStrings = [];

  try {
    const response = await fetch(reqUrl);
    const data = await response.json();

    if (response.ok) {
      const rows = data.results;
      rows.forEach(row => {
        const {city, background, team_member_name, state, job_title, start_date} = row.values;
        rowStrings.push(`${team_member_name} is a ${job_title} in ${city}, ${state} who started working for OpenAI on ${new Date(start_date)}. ${background}`)
      });
    } else {
      console.error(`Request failed: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
  return rowStrings;
}


const generateVectors = async (rows) => {

  const reqUrl = 'https://api.openai.com/v1/embeddings';
  const payload = {
    input: rows,
    model: 'text-embedding-ada-002'
  };

  try {
    const response = await fetch(reqUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()
    const embeddings = data.data.map(item => {
      const row = rows[item.index]
      return {
        id: String(item.index),
        values: item.embedding,
        metadata: {text: row}
      }
    })
    return embeddings;

  } catch (error) {
    console.error('Error:', error);
  }
}


const upsertToPinecone = async (embeddings) => {
  const index = pinecone.Index("hubvectordb");
  const upsertRequest = {
    vectors: embeddings
  };
  try{
    const upsertResponse = await index.upsert({ upsertRequest });
    console.log("success! ", upsertResponse)
  }catch(error){
    console.log(error)
  }

}

const rows = await hubdbToText(tableId, portalId)

const embeddings = await generateVectors(rows)

upsertToPinecone(embeddings);
