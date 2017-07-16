interface ViewModel {
    tid: number,
    typename: string,
    arctype: string,
    play: number,
    review: number,
    video_review: number,
    favorites: number,
    title: string,
    description: string,
    pic: string,
    author: string,
    mid: number,
    face: string,
    pages: number,
    instant_server: string,
    created: number,
    created_at: string,
    credit: string,
    coins: number,
    cid: number,
    list: Array<{
        page: number,
        type: string,
        part: string,
        cid: number,
        weblinl: string,
        vid: string,
        has_alias: boolean
    }>
}


export default ViewModel;