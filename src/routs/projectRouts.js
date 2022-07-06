const express = require('express');
const fs = require('fs');
const auth = require('../middleware/auth');
const Project = require('../models/projectModel.js');
const { uploadAudio, uploadVideo } = require('../middleware/uploads.js');
const { uploadToS3, downloadFromS3, deleteFileFromS3 } = require('../utils/s3.js');
const { getConcatVideo, removeAllAtomsFiles } = require('../utils/get-concat-video.js');
const router = new express.Router();


// -----POST:-----
router.post('/users/projects', auth, async (req, res) => {
    const project = new Project({
        ...req.body,
        owner: req.user._id
    });
    try {
        await project.save();
        res.status(201).send(project);
    } catch (e) {
        res.status(400).send(e);
    }
});

router.post('/users/projects/:id/audioTrack', auth, uploadAudio.single('audioTrack'), async (req, res) => {
    const _id = req.params.id;
    const file = req.file;
    const project = await Project.findOne({ _id, owner: req.user._id });
    if (!project) {
        fs.unlinkSync(file.path);
        throw new Error('error');
    }
    if (project.audioTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log("audioTrack is deleted from s3", deleteVideoTrackResults);
    }
    // manipulate the file here...
    // if not, use: multer-s3
    const uploadResult = await uploadToS3(file);
    project.audioTrack = uploadResult.Key;
    await project.save();
    fs.unlinkSync(file.path);

    res.send('success');
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});

router.post('/users/projects/:id/sections', auth, async (req, res) => {
    const _id = req.params.id;
    const project = await Project.findOne({ _id, owner: req.user._id });
    if (!project) {
        throw new Error('error');
    }

    const sorted_arr = req.body.map(sec => sec.secName).sort();
    for (let i = 1; i < sorted_arr.length; i++) {
        if (sorted_arr[i] === sorted_arr[i - 1]) {
            throw new Error('secName must be unique');
        }
    }

    for (let i = 0; i < project.sections.length; i++) {
        if (!req.body.some(newSec => newSec.secName === project.sections[i].secName)) {
            await project.sections[i].remove();
        }
    }

    const newSections = req.body.map(sec => {
        const existSec = project.sections.find(exSec => exSec.secName === sec.secName);
        if (existSec) {
            return { ...sec, _id: existSec._id };
        }
        return sec;
    });
    project.sections = newSections;
    await project.save();

    res.send(project.sections);
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});


// -----GET:-----
router.get('/users/projects', auth, async (req, res) => {
    try {
        await req.user.populate('projects');
        res.send(req.user.projects);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        res.send(project);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id/audioTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        const userAudioTrack = downloadFromS3(project.audioTrack);
        userAudioTrack.pipe(res);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id/concatVideo', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        const userAudioTrack = downloadFromS3(project.audioTrack);
        const videos = [];
        for (let sec of project.sections) {
            const sectionVideoTrack = downloadFromS3(sec.videoTrack);
            videos.push(sectionVideoTrack);
        }
        const [clipStream, allPaths] = await getConcatVideo(userAudioTrack, videos, project.allowed, project._id);

        clipStream.pipe(res).on('finish', () => removeAllAtomsFiles(allPaths));
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id/sections/:sec', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        res.send(section);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/users/projects/:id/sections/:sec/videoTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        const sectionVideoTrack = downloadFromS3(section.videoTrack);
        sectionVideoTrack.pipe(res);

    } catch (e) {
        res.status(500).send();
    }
});


// -----PATCH:-----
router.patch('/users/projects/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['projectName', 'sections', 'allowed'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    const _id = req.params.id;
    const project = await Project.findOne({ _id, owner: req.user._id });
    if (!project) {
        return res.status(404).send();
    }

    try {
        updates.forEach((update) => project[update] = req.body[update]);
        await project.save();
        res.send(project);
    } catch (e) {
        res.status(400).send(e)
    }
});


router.patch('/users/projects/:id/sections/:sec/videoTrack', auth, uploadVideo.single('videoTrack'), async (req, res) => {
    const _id = req.params.id;
    const file = req.file;

    const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
    if (!project) {
        fs.unlinkSync(file.path);
        return res.status(404).send();
    }
    const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

    if (section.secure) {
        if (req.user.email !== section.targetEmail) {
            fs.unlinkSync(file.path);
            return res.status(404).send();
        }
    }

    if (section.videoTrack) {
        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log("videoTrack is deleted from s3", deleteVideoTrackResults);
    }

    
    //! go to function that Shortens or lengthens the video by the seconds
    //? Is it right to change video files to the desired length here as well? Can create order but not economical in the cloud

    const uploadResult = await uploadToS3(file);
    section.videoTrack = uploadResult.Key;
    await project.save();
    fs.unlinkSync(file.path);

    res.send('success');
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});


// -----DELETE:-----
router.delete('/users/projects/:id', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        project.remove();
        res.status(204).send();
    } catch (e) {
        res.status(500).send();
    }
});

router.delete('/users/projects/:id/audioTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, owner: req.user._id });
        if (!project) {
            return res.status(404).send()
        }
        const deleteAudioTrackResults = await deleteFileFromS3(project.audioTrack);
        console.log(deleteAudioTrackResults);

        project.audioTrack = "";
        project.save();

        res.status(204).send();
    } catch (e) {
        res.status(500).send();
    }
});

router.delete('/users/projects/:id/sections/:sec/videoTrack', auth, async (req, res) => {
    const _id = req.params.id;
    try {
        const project = await Project.findOne({ _id, 'sections._id': req.params.sec });
        if (!project) {
            return res.status(404).send();
        }
        const section = project.sections.find(mySec => mySec._id.toString() === req.params.sec);

        if (section.secure) {
            if (req.user.email !== section.targetEmail) {
                return res.status(404).send();
            }
        }

        const deleteVideoTrackResults = await deleteFileFromS3(section.videoTrack);
        console.log(deleteVideoTrackResults);

        section.videoTrack = "";
        project.save();

        res.status(204).send();

    } catch (e) {
        res.status(500).send();
    }
});



module.exports = router;