import Typesense from "typesense";

export const client = new Typesense.Client({
  nodes: [
    {
      host: "localhost",
      port: 8108,
      protocol: "http",
    },
  ],
  apiKey: "xyz", // same key you used in docker
  connectionTimeoutSeconds: 2,
});