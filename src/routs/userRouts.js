const express = require('express');
const User = require('../models/userModel.js');
const auth = require('../middleware/auth.js');
const router = new express.Router();

// -----POST:-----
router.post('/users/signup', async (req, res) => {
    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        createdAt: new Date()
    });
    try {
        await user.save();
        if (req.body.rememberMe) {
            const token = await user.generateAuthToken();
            res.status(201).send({ user, token });
        } else {
            res.status(201).send({ user });
        }
    } catch (e) {
        res.status(400).send(e);
    }
});

router.post('/users/signin', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);
        if (req.body.rememberMe) {
            const token = await user.generateAuthToken();
            res.send({ user, token });
        } else {
            res.send({ user });
        }
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
    res.send({_id: user._id, name: user.name, email: user.email, projects: user.projects});
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