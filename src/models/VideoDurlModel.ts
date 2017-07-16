interface VideoDurlModel {
    order: number,
    length: number,
    size: number,
    url: string,
    backup_url: Array<string>
}

export default VideoDurlModel;