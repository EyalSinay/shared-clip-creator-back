const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const getConcatVideo = async (audio, videosArr, allowed, projectId) => {
    // videos:
    allPromises = [];
    videosPaths = [];
    for (let i = 0; i < videosArr.length; i++) {
        // ! if no video, create empty
        const videoPath = __dirname + `/files/${projectId}-video-${i}.mp4`;
        videosPaths.push(videoPath);
        const videoWritableStream = fs.createWriteStream(videoPath);
        const pipeVideo = videosArr[i].pipe(videoWritableStream);
        const videoPromise = new Promise((resolve, reject) => {
            pipeVideo.on('finish', () => resolve(`video ${i} finish`))
                .on('error', (e) => reject(`video ${i} error: ${e}`));
        });
        allPromises.push(videoPromise);
    }

    // audio:
    const audioPath = __dirname + `/files/${projectId}-audio.mp3`;
    const audioWritableStream = fs.createWriteStream(audioPath);
    const pipeAudio = audio.pipe(audioWritableStream);
    const audioPromise = new Promise((resolve, reject) => {
        pipeAudio.on('finish', () => resolve("audio finish"))
            .on('error', (e) => reject("audio error: " + e));
    });
    allPromises.push(audioPromise);

    await Promise.all(allPromises)
        .then((results) => console.log(results))
        .catch((error) => console.log(error));


    // concatVideos:
    const concatVideoPath = __dirname + `/files/${projectId}-concat-video.mp4`;
    const concatVideos = new ffmpeg();
    for (let i = 0; i < videosPaths.length; i++) {
        concatVideos.addInput(videosPaths[i]);
    }
    await new Promise((resolve, reject) => {
        concatVideos
            .on('end', () => resolve("videos concat done"))
            .on('error', () => reject("videos concat error"))
            .mergeToFile(concatVideoPath);
    }).then((results) => console.log(results))
        .catch((error) => console.log(error));


    // create clip:
    const clipPath = __dirname + `/files/${projectId}-output.mp4`
    const clip = new ffmpeg({ source: concatVideoPath })
        .addInput(audioPath)
        .complexFilter('amix');
    if (!allowed) {
        clip.videoFilters({
            filter: 'drawtext',
            options: {
                fontfile: '../assets/fonts/COOPBL.TTF',
                text: 'טקסט מעצבן עד שתשלם',
                fontsize: 28,
                fontcolor: 'white',
                x: '(main_w/2-text_w/2)',
                y: '(main_h/2-text_h/2)',
                shadowcolor: 'black',
                shadowx: 2,
                shadowy: 2
            }
        });
    }
    await new Promise((resolve, reject) => {
        clip.on('end', () => resolve("DONE!"))
            .on('error', (err) => {
                reject("create clip error:\n" + err);
            })
            .saveToFile(clipPath);
    }).then((results) => console.log(results))
        .catch((error) => console.log(error));

    const clipStream = fs.createReadStream(clipPath);

    const allPaths = [];
    for (const videoTrackPath of videosPaths) {
        allPaths.push(videoTrackPath);
    }
    allPaths.push(audioPath);
    allPaths.push(concatVideoPath);
    allPaths.push(clipPath);

    return [clipStream, allPaths];
}
exports.getConcatVideo = getConcatVideo;


const removeAllAtomsFiles = (allPaths) => {
    for (const path of allPaths) {
        fs.unlinkSync(path);
    }
}
exports.removeAllAtomsFiles = removeAllAtomsFiles;