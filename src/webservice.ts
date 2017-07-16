///<reference path="../node_modules/@types/node/index.d.ts"/>
///<reference path="../node_modules/@types/express/index.d.ts"/>
///<reference path="../node_modules/@types/body-parser/index.d.ts"/>


import tools from "./tools";
import { downloadVideo } from "./video"
import * as fs from "fs";
import * as path from "path";
import * as morgan from "morgan";
import * as express from "express";
import * as bodyParser from "body-parser";

tools.mkdirSync(path.join(__dirname, "storage"));

const app: express.Application = express();

app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/video.action/:id", async function (res, req) {
    var id: any = res.params["id"];
    var part: any = res.query["part"] || "1";

    if (id.substring(0, 2) !== "av") return req.status(503).send("invalid video id.");
    id = parseInt(id.replace("av", ""));
    if (isNaN(id)) return req.status(503).send("invalid video id.");

    part = parseInt(part);
    if (isNaN(part)) return req.status(503).send("invalid part id.");
    if (part <= 0) return req.status(503).send("invalid part id.");
    if (part >= 500) return req.status(503).send("invalid part id.");

    var directory = path.join(__dirname, "storage", `${id.toString()}_${part.toString()}`);
    if (await tools.getFileState(directory) === null) {
        tools.mkdirSync(directory);
    }
    var videoStateFile = path.join(directory, "state");
    if (await tools.getFileState(videoStateFile) !== null) {
        let state: VideoState = JSON.parse(await tools.readFile(videoStateFile));
        if (state.state == "PROCESSING" && state.pid === process.pid) {
            return req.status(500).send("processing.");
        }
        if (state.state == "DONE") {
            state.access_time = tools.getTime();
            tools.writeObjectFileSync(videoStateFile, state);
            return req.sendFile(path.join(directory, "video.mp4"));
        }
    }

    let state: VideoState = {
        state: "PROCESSING",
        pid: process.pid,
        create_time: tools.getTime(),
        access_time: tools.getTime(),
        finish_time: -1,
    }

    tools.writeObjectFileSync(videoStateFile, state);
    downloadVideo(id, part, directory).then(() => {
        state.state = "DONE";
        state.finish_time = tools.getTime();
        tools.writeObjectFileSync(videoStateFile, state);
        console.log(`------------ tash has been done. ------------`)
    }).catch(err => {
        console.error(err);
        state.state = "ERROR";
        tools.writeObjectFileSync(videoStateFile, state);
    });

    return req.status(500).send("task has been submited.");
});

app.listen(15115, function () {
    console.log(`listening at port 15115`);
});

function deleteExpiredVideos() {
    var storagePath: string = path.join(__dirname, "storage");
    var directories: Array<string> = fs.readdirSync(storagePath);
    for (var directory of directories) {
        let directoryPath: string = path.join(storagePath, directory);
        let statePath: string = path.join(directoryPath, "state");
        if (!fs.existsSync(statePath)) {
            tools.rmrfDirSync(directoryPath);
            continue;
        }
        let state: VideoState = JSON.parse(fs.readFileSync(statePath).toString());
        if ((state.state === "PROCESSING" || state.state === "ERROR") && state.pid !== process.pid) {
            tools.rmrfDirSync(directoryPath);
            continue;
        }
        /* 如果视频超过722小时没有人访问则删除视频 */
        var time: number = tools.getTime();
        if (state.state === "DONE" && Math.floor((time - state.access_time) / 60 / 60) >= 722) {
            tools.rmrfDirSync(directoryPath);
            continue;
        }
        /* 如果视频超过8小时仍在PROCESSING阶段删除视频 */
        if (state.state === "PROCESSING" && Math.floor((time - state.create_time) / 60 / 60) >= 8) {
            tools.rmrfDirSync(directoryPath);
            continue;
        }
    }
}

deleteExpiredVideos();
setInterval(deleteExpiredVideos, 1000 * 60 * 10);

interface VideoState {
    state: "PROCESSING" | "DONE" | "ERROR",
    pid: number,
    create_time: number,
    access_time: number,
    finish_time: number,
}

process.on("uncaughtException", async function (err) {
    await tools.writeFile(path.join(__dirname, `error_${tools.getTime()}`), err.toString());
});
