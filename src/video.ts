///<reference path="../node_modules/@types/node/index.d.ts"/>

import tools from "./tools";
import constant from "./constant";
import * as fs from "fs";
import * as path from "path";
import * as superagent from "superagent";
import * as child_process from "child_process";

import ViewModel from "./models/ViewModel";
import VideoModel from "./models/VideoModel";
import VideoDurlModel from "./models/VideoDurlModel";

export async function downloadVideo(id: number, page: number, rootPath: string) {
    var view: ViewModel = await getView(id, page);
    var video: VideoModel = await getVideo(view.cid);

    for (let durl of video.durl) {
        await downloadDurlToDirectory(id, durl, rootPath);
    }

    /* 合并视频并转换成MP4 */
    console.log("ffmpeg is conventing flv to mp4.")
    for (let durl of video.durl) {
        let inputDurlFilePath = path.join(rootPath, `${durl.order}.flv`);
        let outputDurlFilePath = path.join(rootPath, `${durl.order}.mp4`);
        await ffmpeg(["-i", inputDurlFilePath, "-codec", "copy", outputDurlFilePath]);
        fs.unlinkSync(inputDurlFilePath);
    }
    console.log("ffmpeg has finished conventing task");

    let outputDurlFilePath = path.join(rootPath, `video.mp4`);
    if (video.durl.length === 1) {
        let inputDurlFilePath = path.join(rootPath, `1.mp4`);
        fs.renameSync(inputDurlFilePath, outputDurlFilePath);
        return;
    }
    console.log("ffmpeg is merging files");
    var mergeFilesList = "# this is a comment\n" + (video.durl.map(x => `file ${path.join(rootPath, x.order + ".mp4")}`).join("\n"));
    var mergeFilesListFile = path.join(rootPath, `merge.txt`);
    await tools.writeFile(mergeFilesListFile, mergeFilesList);
    await ffmpeg(["-safe", "0", "-f", "concat", "-i", mergeFilesListFile, "-c", "copy", outputDurlFilePath]);
    console.log("ffmpeg has finished merging files.");

    for (let durl of video.durl) {
        let durlFilePath = path.join(rootPath, `${durl.order}.mp4`);
        fs.unlinkSync(durlFilePath);
    }
}

function downloadDurlToDirectory(id: number, durl: VideoDurlModel, directoryPath: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
        try {
            var directoryState = await tools.getFileState(directoryPath);
            if (directoryState === null) {
                await tools.mkdir(directoryPath);
            } else {
                if (!directoryState.isDirectory()) return reject("存储路径不是文件夹");
            }
            /* 视频分片再分片 */
            var ranges: Array<{ min: number, max: number, done: boolean, processing?: any }> = [];
            for (let range of rangeFile(durl.size)) ranges.push(Object.assign(range, { done: false }));

            for (let i = 0; i < ranges.length; i++) {
                let range = ranges[i];
                let header = {
                    "Referer": "bilibili.com",
                    "Range": `bytes=${range.min}-${range.max}`,
                    "User-Agent": "Minecraft BakaXL Launch/0.0.1",
                }
                let filePath = path.join(directoryPath, `${durl.order}_${i}`);
                console.log(`Downloading ${durl.order}-${i} of av${id}`);
                await tools.downloadPromise(durl.url, header, filePath, 10 * 1000);
            }

            let writeStream = fs.createWriteStream(path.join(directoryPath, `${durl.order}.flv`));
            for (let i = 0; i < ranges.length; i++) {
                let rangeFilePath = path.join(directoryPath, `${durl.order}_${i}`);
                let readStream = fs.createReadStream(rangeFilePath);
                console.log(`merging ${durl.order}-${i} of av${id}`);
                await connectStream(writeStream, readStream);
                readStream.close();
                await fs.unlinkSync(rangeFilePath);
            }
            writeStream.close();
            console.log(`Downloading part.${durl.order}.flv of av${id} has been done.`);
        } catch (error) {
            return reject(error);
        }
        resolve();
    });
}

function connectStream(w: fs.WriteStream, r: fs.ReadStream): Promise<any> {
    return new Promise((resolve, reject) => {
        r.on("data", (data) => {
            r.pause();
            w.write(data, () => r.resume());
        });
        r.on("error", reject);
        r.on("end", resolve);
    });
}

function rangeFile(fileSize: number): Array<{ min: number, max: number }> {
    var rangeArray: Array<{ min: number, max: number }> = [];

    var range: number = 1024 * 1024 * 3;
    if (range > fileSize) range = fileSize;
    var pointer: number = range;
    var lastPointer: number = 0;

    while (true) {
        rangeArray.push({
            min: lastPointer,
            max: pointer
        });
        lastPointer = pointer + 1;
        if (pointer == fileSize) break;
        if (pointer + range > fileSize) {
            pointer = pointer + (fileSize - pointer);
        } else {
            pointer = pointer + range;
        }
    }
    return rangeArray;
}

async function getView(id: number, page: number = 1): Promise<ViewModel> {
    return tools.getRequest(`http://api.bilibili.com/view?appkey=${constant.APP_KEY}&ts=${tools.getTime()}&id=${id}&page=${page}`);
}

async function getVideo(cid: number, type: string = "flv"): Promise<VideoModel> {
    var data = getSign({
        "cid": cid,
        "from": "local",
        "player": "1",
        "otype": "json",
        "type": type,
        "quality": "3",
        "appkey": constant.APP_KEY,
    }, constant.APP_SECRET);

    return tools.getRequest(`https://interface.bilibili.com/playurl?${data.params}&sign=${data.sign}`);
}

function getSign(params, key: string): { sign: string, params: any } {
    var s_keys = Object.keys(params);
    s_keys = s_keys.sort();
    var data = "";
    for (var i = 0; i < s_keys.length; i++) {
        data += (data ? "&" : "") + s_keys[i] + "=" + encodeURIComponent(params[s_keys[i]]);
    }
    return {
        "sign": tools.md5(data + key),
        "params": data
    };
}

function ffmpeg(args: Array<string>): Promise<number> {
    return new Promise((resolve, reject) => {
        var child = child_process.spawn(constant.FFMPEG, args, {});

        var timer = setInterval(() => child.stdin.write("y\n"), 5000);
        child.stdin.on("error", (error) => { });

        child.on("error", function (error) {
            clearInterval(timer);
            reject(error);
        });
        child.stdout.on("data", (data) => { });
        child.stderr.on("data", (data) => { });
        child.on("exit", async function (code) {
            clearInterval(timer);
            resolve(code);
        });
    });
}




