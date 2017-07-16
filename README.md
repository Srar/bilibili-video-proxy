# bilibili-video-proxy

当使用从bilibili申请的API时候会遇到申请的API权限过低, 导致获取视频的连接存在限速(每个连接会限制流量5M或更低到达流量后需要等30秒左右才能继续请求后续5M然后再等30秒循环)的问题.

## 已实现功能

* 解决bilibili低权限api使用高清视频连接限速问题(使用http-range缩小请求数据量).
* 视频多个`durl`自动使用`ffmpeg`合并.
* bilibili官方优先使用`flv`, 当全部分段合并后会自动转码成`mp4`保存.
* 当已经缓存的视频无访问超过722小时后自动删除.

## 使用

1. `constant.ts`文件内填写从bilibili申请到的`APP_KEY`与`APP_SECRET`.
2. `constant.ts`文件内`FFMPEG`路径修改为您服务器上的`FFMPEG`的路径.
3. 执行`npm install`, `npm run build`.
4. 前往`build`文件夹内执行`webservice.js`默认端口监听在`15115`.
5. 访问`http://your_ip:15115/video.action/视频编号?part=视频分P`
   * 返回`500 task has been submited.`处理视频任务已提交.
   * 返回`500 processing`仍在处理视频.
6. 直接返回视频数据, 如浏览器支持则会自动开始播放.