const nodemailer = require('nodemailer');
require('dotenv').config();

const emailPassword = process.env.EMAIL_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'collaclip@hotmail.com',
        pass: emailPassword
    }
});

const welcomeMail = (userAddress, userName) => {
    const mailOptions = {
        from: 'collaclip@hotmail.com',
        to: userAddress,
        subject: 'Welcome to CollaClip!',
        html: `<h1>Hi ${userName}, and welcome to CollaClip!</h1><p>Thank you for choosing to create a clip easily with CollaClip.</p>`,
        // amp: `<!doctype html>
        // <html ⚡4email>
        //   <head>
        //     <meta charset="utf-8">
        //     <style amp4email-boilerplate>body{visibility:hidden}</style>
        //     <script async src="https://cdn.ampproject.org/v0.js"></script>
        //     <script async custom-element="amp-anim" src="https://cdn.ampproject.org/v0/amp-anim-0.1.js"></script>
        //   </head>
        //   <body>
        //     <p>Image: <amp-img src="https://cldup.com/P0b1bUmEet.png" width="16" height="16"/></p>
        //     <p>GIF (requires "amp-anim" script in header):<br/>
        //       <amp-anim src="https://cldup.com/D72zpdwI-i.gif" width="500" height="350"/></p>
        //   </body>
        // </html>`
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}
exports.welcomeMail = welcomeMail;

// ! check!
const userToParticipants = (userMailAddress, userName, projectName, participant) => {
    participantAddress = participant.targetEmail;
    participantName = participant.secName;
    message = participant.message.paragraphsArr;

    const mailOptions = {
        from: 'collaclip@hotmail.com',
        to: participantAddress,
        subject: 'You got a section in CollaClip project!',
        html: `<h1>Hello ${participantName}!</h1><h2>from email address: ${userMailAddress}</h2><h3>${userName} join u to project:</h3><h3>${projectName}</h3>${message.map(p => `<p>${p}</p>`)}`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}
exports.userToParticipants = userToParticipants;