import VideoDurlModel from "./VideoDurlModel";

interface VideoModel {
    from: string,
    result: string,
    format: string,
    timelength: number,
    accept_format: string,
    accept_quality: Array<number>,
    seek_param: string,
    seek_type: string,
    durl: Array<VideoDurlModel>
}

export default VideoModel