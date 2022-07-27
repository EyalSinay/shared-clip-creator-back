const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { rootPath } = require('./global-vars')

// ! Create abort stations (maybe by push the paths to delete every step, and on error delete them)
// ? Maybe it's possible already in the first part, to get the files by stream input, resize them, and export them to a ts files!
// ! set volume audio and videos!
const getConcatVideo = async (audio, files, allowed, projectId, scale) => {
    console.log("Starting to create clip for: " + projectId);
    // videos:
    const allPromises = [];
    const videosPaths = [];
    for (let i = 0; i < files.length; i++) {
        let videoPath = __dirname + `/files/${projectId}-${Date.now()}`;

        if (files[i].type === "video") {
            videoPath += `-video-${i}.mp4`;
            const videoWritableStream = fs.createWriteStream(videoPath);
            const pipeVideo = files[i].file.pipe(videoWritableStream);
            const videoPromise = new Promise((resolve, reject) => {
                pipeVideo.on('finish', () => resolve(`video ${i} finish`))
                    .on('error', (e) => reject(`video ${i} error: ${e}`));
            });
            videosPaths.push(videoPath);
            allPromises.push(videoPromise);

        } else if (files[i].type === "image") {

            videoPath += `-imageVideo-${i}.mp4`;
            const imageVideo = new ffmpeg(files[i].file)
                .loop(files[i].duration)
                .output(videoPath)
                .outputOptions('-pix_fmt yuv420p')
                .videoCodec('libx264')
                .complexFilter('anullsrc=channel_layout=5.1:sample_rate=48000')
                .size(scale)
                .autopad();

            const videoPromise = new Promise((resolve, reject) => {
                imageVideo.on('end', () => resolve(`image video ${i} finish`))
                    .on('error', (e) => reject(`image video ${i} error: ${e}`))
                    .run();
            });
            videosPaths.push(videoPath);
            allPromises.push(videoPromise);

        } else if (files[i].type === "no-file") {

            videoPath += `-emptyVideo-${i}.mp4`;
            const emptyVideo = new ffmpeg({ source: __dirname + '/assets/logo-corner.png' })
                .loop(files[i].duration)
                .output(videoPath)
                .outputOptions('-pix_fmt yuv420p')
                .videoCodec('libx264')
                .complexFilter('anullsrc=channel_layout=5.1:sample_rate=48000')
                .size(scale)
                .autopad('white')
                .videoFilters({
                    filter: 'drawtext',
                    options: {
                        fontfile: '',
                        text: `participant ${i + 1}`, //! change to name of section
                        fontsize: 60,
                        fontcolor: 'black',
                        x: '(main_w/2-text_w/2)',
                        y: '(main_h/3-text_h/2)',
                        shadowcolor: 'black',
                        shadowx: 2,
                        shadowy: 2
                    }
                });

            const videoPromise = new Promise((resolve, reject) => {
                emptyVideo.on('end', () => resolve(`empty video ${i} finish`))
                    .on('error', (e) => reject(`empty video ${i} error: ${e}`))
                    .run();
            });
            videosPaths.push(videoPath);
            allPromises.push(videoPromise);

        } else {
            throw new Error("maaa")
        }
    }

    // audio:
    const audioPath = __dirname + `/files/${projectId}-${Date.now()}-audio.mp3`;
    const audioWritableStream = fs.createWriteStream(audioPath);
    const pipeAudio = audio.pipe(audioWritableStream);
    const audioPromise = new Promise((resolve, reject) => {
        pipeAudio.on('finish', () => resolve("audio finish"))
            .on('error', (e) => reject("audio error: " + e));
    });
    allPromises.push(audioPromise);

    try {
        const results = await Promise.all(allPromises);
        console.log(results);
    } catch (err) {
        console.error(err);
    }

    // ! add volume options

    // resizeVideos:
    const resizeVideosPathsArr = [];
    const resizeVideosPromisesArr = [];
    for (let i = 0; i < videosPaths.length; i++) {
        const resizeVideosPath = __dirname + `/files/${projectId}-${Date.now()}-resize-video-${i}.ts`;
        resizeVideosPathsArr.push(resizeVideosPath);
        const resizeVideosFfmpeg = new ffmpeg();
        resizeVideosFfmpeg
            .addInput(videosPaths[i])
            .size(scale).autopad();

        const resizeVideoPromise = new Promise((resolve, reject) => {
            resizeVideosFfmpeg
                .on('end', () => resolve("video " + i + " resize done"))
                .on('error', () => reject("video " + i + " resize error"))
                .saveToFile(resizeVideosPath);
        })
        resizeVideosPromisesArr.push(resizeVideoPromise)
    }
    try {
        const result = await Promise.all(resizeVideosPromisesArr);
        console.log(result);
    } catch (err) {
        console.error(err);
    }


    // convert to ts file:
    const tsVideosPathsArr = [];
    const tsVideosPromisesArr = [];
    for (let i = 0; i < resizeVideosPathsArr.length; i++) {
        const tsVideosPath = __dirname + `/files/${projectId}-${Date.now()}-convert-video-ts-${i}.ts`;
        tsVideosPathsArr.push(tsVideosPath);
        const tsVideosFfmpeg = new ffmpeg();
        tsVideosFfmpeg
            .addInput(resizeVideosPathsArr[i])
            .audioCodec('copy')
            .videoCodec('copy');

        const tsVideoPromise = new Promise((resolve, reject) => {
            tsVideosFfmpeg
                .on('end', () => resolve("video " + i + " convert to ts done"))
                .on('error', () => reject("video " + i + " convert to ts error"))
                .saveToFile(tsVideosPath);
        })
        tsVideosPromisesArr.push(tsVideoPromise)
    }
    try {
        const results = await Promise.all(tsVideosPromisesArr);
        console.log(results);
    } catch (err) {
        console.error(err);
    }

    // concat ts files:
    const concatTsPath = __dirname + `/files/${projectId}-${Date.now()}-concat-video.ts`;
    const concatCommend = new ffmpeg();
    for (let path of tsVideosPathsArr) {
        concatCommend.input(path);
    }
    try {
        const result = await new Promise((resolve, reject) => {
            concatCommend.on('end', () => resolve("videos concat done"))
                .on('error', (err) => reject(err))
                .mergeToFile(concatTsPath, __dirname + '/files/temporary');
        });
        console.log(result);
    } catch (err) {
        console.error(err);
    }


    // convert ts to mp4:
    const mp4ConcatPath = __dirname + `/files/${projectId}-${Date.now()}-mp4Concat.mp4`;
    const mp4ConcatCommend = new ffmpeg()
        .input(concatTsPath)
    // .outputOptions('-pix_fmt yuv420p') //! i don't think that i need it now but if in the future another types of files will be accept...
    try {
        const resolve = await new Promise((resolve, reject) => {
            mp4ConcatCommend.on('end', () => resolve("videos convert to mp4 done"))
                .on('error', (err) => reject("videos convert to mp4 ERROR!", err))
                .saveToFile(mp4ConcatPath);
        });
        console.log(resolve);
    } catch (err) {
        console.error(err);
    }


    // create clip:
    const clipPath = __dirname + `/files/${projectId}-${Date.now()}-output.mp4`
    const clip = new ffmpeg({ source: mp4ConcatPath })
        .addInput(audioPath)
        .complexFilter('amix');
    if (!allowed) {
        clip.videoFilters({
            filter: 'drawtext',
            options: {
                fontfile: __dirname + '/assets/fonts/COOPBL.TTF',
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
    try {
        const result = await new Promise((resolve, reject) => {
            clip.on('end', () => resolve("DONE!"))
                .on('error', (err) => {
                    reject("create clip error:\n" + err);
                })
                .saveToFile(clipPath);
        });
        console.log(result);
    } catch (err) {
        console.error(err);
    }

    const clipStream = fs.createReadStream(clipPath);

    const allPaths = [];
    for (const videoTrackPath of videosPaths) {
        allPaths.push(videoTrackPath);
    }
    for (const videoTrackPath of resizeVideosPathsArr) {
        allPaths.push(videoTrackPath);
    }
    for (const videoTrackPath of tsVideosPathsArr) {
        allPaths.push(videoTrackPath);
    }
    allPaths.push(audioPath);
    allPaths.push(concatTsPath);
    allPaths.push(mp4ConcatPath);
    allPaths.push(clipPath);

    return [clipStream, allPaths];
}
exports.getConcatVideo = getConcatVideo;



const removeAllAtomsFiles = (allPaths) => {
    for (const path of allPaths) {
        if (fs.existsSync(path)) fs.unlinkSync(path);
    }
}
exports.removeAllAtomsFiles = removeAllAtomsFiles;



const videoShortens = async (duration, filePath, startTime = 0) => {
    const fullFilePath = rootPath + "/" + filePath;

    let movieDuration;
    try {
        await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(fullFilePath, (err, metadata) => {
                movieDuration = metadata.format.duration;
                resolve(movieDuration);
                if (err) reject(err);
            });
        });
    } catch (err) {
        console.error(err);
    }

    if (movieDuration < duration) {
        return "TO_SHORT"; //! allow the user to upload short video and Repeat last frame.
    }

    if (movieDuration > duration) {
        const videoTrack = new ffmpeg({ source: fullFilePath })
            // .setStartTime(startTime); //! allow the user determine start time
            .duration(duration);
        try {
            await new Promise((resolve, reject) => {
                videoTrack.on('end', () => resolve("DONE!"))
                    .on('error', err => reject(err))
                    .saveToFile(fullFilePath + ".mp4");
            });
        } catch (err) {
            console.error(err);
        }
        return "SHORTED";
    }

    return "WOW"
}
exports.videoShortens = videoShortens;