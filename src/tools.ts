import * as fs from "fs"
import * as crypto from "crypto";
import * as superagent from "superagent"
import * as http from "http";
import * as https from "https";
import * as path from "path";

export default {
    writeFile(path: string, data: string) {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, data, function (err) {
                if (err) return reject(err)
                resolve();
            })
        });
    },

    mkdirSync(path: string) {
        try {
            fs.mkdirSync(path);
        } catch (error) {

        }
    },

    rmrfDirSync(directory: string) {
        if (fs.existsSync(directory)) {
            fs.readdirSync(directory).forEach(function (file, index) {
                var curPath: string = path.join(directory, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.rmrfDirSync(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            }.bind(this));
            fs.rmdirSync(directory);
        }
    },

    writeObjectFileSync(path: string, data: object) {
        try {
            fs.writeFileSync(path, JSON.stringify(data));
        } catch (error) {

        }
    },

    downloadPromise: function (url: string, header: object, filePath: string, timeout: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.download(url, header, filePath, timeout, function (err) {
                err ? reject(err) : resolve();
            });
        });
    },

    download: function (url: string, header: object, filePath: string, timeout: number, callback: Function, tryingCount: number = 0) {
        let isHttps: boolean = url.substring(0, 5) === "https";
        let httplib: any = isHttps ? https : http;
        let protocol: string = isHttps ? "https" : "http"
        let domain: string = isHttps ? url.replace("https://", "") : url.replace("http://", "");
        /* 先做GET PATH切割 */
        let path = "";
        if (domain.indexOf("/") === -1) {
            path = "/"
        } else {
            path = domain.substring(domain.indexOf("/"));
            domain = domain.substring(0, domain.indexOf("/"));
        }

        let port: number = isHttps ? 443 : 80;
        if (domain.indexOf(":") != -1) {
            port = parseInt(domain.substring(domain.indexOf(":") + 1));
            domain = domain.substring(0, domain.indexOf(":"));
        }

        var options = {
            hostname: domain,
            path: path,
            port: port,
            method: "GET",
            headers: header
        };

        var response: http.IncomingMessage = null;
        var request = httplib.request(options, (res: http.IncomingMessage) => {
            response = res;
            if (response.statusCode === 301 || response.statusCode === 302) {
                var target = <string>response.headers["location"];
                if (target.substring(0, 4) !== "http") target = `${protocol}://${options.hostname}/${target}`;
                return this.download(target, header, filePath, timeout, callback, tryingCount);
            }

            var timeoutTimer = setTimeout(() => response.emit("error", "timeout."), timeout);

            let stream = fs.createWriteStream(filePath);

            stream.on("error", () => { });

            response.on("data", (chunk) => {
                response.pause();
                stream.write(chunk, () => response.resume());
            });
            response.on("error", (err) => {
                clearTimeout(timeoutTimer);
                response.destroy();
                response.removeAllListeners();
                stream.close();
                if (tryingCount >= 5) return callback(err);
                this.download(url, header, filePath, timeout, callback, ++tryingCount);
            });
            response.on("end", () => {
                clearTimeout(timeoutTimer);
                stream.close();
                response.destroy();
                response.removeAllListeners();
                callback();
            });
        });

        request.on("error", (err) => {
            if (tryingCount > 5) return callback(err);
            this.download(url, header, filePath, timeout, callback, tryingCount++);
        });

        request.end();

        return {
            abort: function () {
                response.emit("error", "user abort.")
            }
        }
    },

    delay(time: number): Promise<void> {
        return <Promise<any>>new Promise((resolve, reject) => {
            setTimeout(resolve, time);
        });
    },

    mkdir(path: string): Promise<void> {
        return <Promise<any>>new Promise((resolve, reject) => {
            fs.mkdir(path, function (err) {
                err ? reject() : resolve();
            });
        });
    },

    getFileState(path: string): Promise<fs.Stats> {
        return new Promise((resolve, reject) => {
            fs.stat(path, function (err, stats) {
                err ? resolve(null) : resolve(stats);
            })
        });
    },

    md5(data: string | Buffer): string {
        return crypto.createHash("md5").update(data).digest("hex");
    },

    openFile(filePath: string, flags: string): Promise<number> {
        return new Promise((resolve, reject) => {
            fs.open(filePath, flags, function (err, id) {
                if (err) return reject(err);
                resolve(id);
            });
        });
    },

    closeFile(fd: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.close(fd, function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    deleteFile(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.unlink(path, function () {
                resolve();
            });
        });
    },

    readFileOriginally(fd: number, buffer: Buffer, offset: number, length: number, position: number): Promise<number> {
        return new Promise((resolve, reject) => {
            fs.read(fd, buffer, offset, length, position, function (err, bytes) {
                if (err) return reject(err);
                resolve(bytes);
            });
        });
    },

    getSha1FromBuffer(buffer: Buffer): string {
        var process = crypto.createHash("sha1");
        process.update(buffer);
        return process.digest("hex");
    },

    getSha1FromFile(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            var fd = fs.createReadStream(path);
            var hash = crypto.createHash('sha1');
            hash.setEncoding('hex');

            fd.on("error", reject)
            fd.on("end", function () {
                hash.end();
                resolve(<string>hash.read());
            });

            fd.pipe(hash);
        });
    },

    getDateString(): {
        year: string, month: string, day: string, hour: string, min: string, sec: string
    } {
        var date = new Date();
        var mouth = date.getMonth() + 1;
        var day = date.getDate();
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        return {
            year: date.getFullYear().toString(),
            month: mouth < 10 ? "0" + mouth : mouth.toString(),
            day: day < 10 ? "0" + day : day.toString(),
            hour: hour < 10 ? "0" + hour : hour.toString(),
            min: min < 10 ? "0" + min : min.toString(),
            sec: sec < 10 ? "0" + sec : sec.toString(),
        }
    },

    getTime(): number {
        return Math.floor(new Date().getTime() / 1000);
    },

    saveObjectToJsonFile(path: string, data: object) {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, JSON.stringify(data, null, 4), function (err) {
                if (err) return reject(err)
                resolve();
            })
        });
    },

    readFile(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(path, function (err, content) {
                if (err) return reject(err)
                resolve(content.toString());
            });
        });
    },

    getFileSize(path: string): Promise<number> {
        return new Promise((resolve, reject) => {
            fs.stat(path, (err, stats: fs.Stats) => {
                if (err) return reject(err);
                resolve(stats.size);
            })
        });
    },

    postRequest: function (url: string, data?: any, header?: object, toJson?: boolean, returnResponse?: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            superagent.post(url).type('form').set(header || {}).send(data || {}).end(function (err, res) {
                if (err) return reject(err);
                if (returnResponse === true) resolve(res);
                toJson === false ? resolve(res.text) : resolve(JSON.parse(res.text));
            });
        });
    },

    postJsonRequest: function (url: string, data?: object, header?: object, toJson?: boolean, returnResponse?: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            superagent.post(url).set(header || {}).set('Content-Type', 'application/json').send(JSON.stringify(data)).end(function (err, res) {
                if (err) return reject(err);
                if (returnResponse === true) resolve(res);
                toJson === false ? resolve(res.text) : resolve(JSON.parse(res.text));
            });
        });
    },

    getRequest: function (url: string, header?: object, toJson?: boolean, returnResponse?: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            header = Object.assign(header || {}, {
                "User-Agent": "Minecraft BakaXL Launch/0.0.1",
            });
            superagent.get(url).set(header).end(function (err, res) {
                if (err) return reject(err);
                if (returnResponse === true) resolve(res);
                toJson === false ? resolve(res.text) : resolve(JSON.parse(res.text));
            });
        });
    }
}
