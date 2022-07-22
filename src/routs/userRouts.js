const express = require('express');
const User = require('../models/userModel.js');
const auth = require('../middleware/auth.js');
const Project = require('../models/projectModel.js');
const { BASE_URL_FRONT } = require('../utils/global-vars.js');
const router = new express.Router();
const {welcomeMail} = require('../utils/nodemailer.js')

// -----POST:-----
router.post('/users/signup', async (req, res) => {
    const participantInProjects = await Project.find({ 'sections.targetEmail': req.body.email });
    const projectsParticipantRrr = [];
    for (let project of participantInProjects) {
        for (let sec of project.sections) {
            if (sec.targetEmail === req.body.email) {
                const projectOwner = await project.populate('owner');
                projectsParticipantRrr.push({
                    projectName: project.projectName,
                    projectOwnerName: projectOwner.owner.name,
                    fullLink: BASE_URL_FRONT + "project/" + project._id + "/section/" + sec._id,
                    link: "/project/" + project._id + "/section/" + sec._id,
                    sectionId: sec._id
                });
            }
        };
    };

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        projectsParticipant: projectsParticipantRrr,
        createdAt: new Date()
    });

    try {
        await user.save();

        welcomeMail(req.body.email, req.body.name);

        const token = await user.generateAuthToken();
        res.status(201).send({ user, token });

    } catch (e) {
        res.status(400).send(e);
    }
});

router.post('/users/signin', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);

        const token = await user.generateAuthToken();
        await user.populate('projects');
        res.send({ user, token, projects: user.projects });

    } catch (e) {
        res.status(400).send(e);
    }
});

router.post('/users/signout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.user.save();

        res.send();
    } catch (e) {
        res.status(500).send();
    }
});

router.post('/users/signoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send();
    } catch (e) {
        res.status(500).send();
    }
});


// -----GET:-----
router.get('/users/user', auth, async (req, res) => {
    const user = await req.user.populate('projects');
    res.send({ user, projects: user.projects });
});


// -----PATCH:-----
router.patch('/users/user', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'email', 'password'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));
    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' });
    }
    try {
        updates.forEach((update) => req.user[update] = req.body[update]);
        await req.user.save();
        res.send(req.user);
    } catch (e) {
        res.status(400).send(e);
    }
});


// -----DELETE:-----
router.delete('/users/user', auth, async (req, res) => {
    try {
        await req.user.remove();
        res.send(req.user);
    } catch (e) {
        res.status(500).send();
    }
})

module.exports = router;