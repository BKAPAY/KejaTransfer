import express, { type Request, type Response } from "express";
import { registerRoutes } from "../server/routes";

const app = express();

app.use(
  express.json({
    limit: "200mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Keep routes initialized across warm invocations
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = registerRoutes(app).then(() => {});
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  await init();
  return new Promise<void>((resolve) => {
    (app as any)(req, res, () => {
      res.status(404).json({ message: "Not found" });
      resolve();
    });
  });
}
