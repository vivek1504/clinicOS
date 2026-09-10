import { Elysia } from "elysia";
import { env } from "./env";
import { app, buildApp } from "./app";

if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME)) {
  app.listen(env.PORT, () => {
    console.log(`EMR Backend listening on port ${env.PORT} (AI provider: ${env.AI_PROVIDER})`);
  });
}

export { app, buildApp };
export default app;

