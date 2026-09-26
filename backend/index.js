import express from "express"
import cors from "cors"
import scheduleRouter from './routes/schedule.js';


const app = express()
app.use(express.json())
app.use(cors())
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

app.use('/', scheduleRouter);

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON' });
  }
  next(err);
});

app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}`)
})