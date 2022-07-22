const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'collaclip@hotmail.com',
        pass: 'Eyal1Moria1!'
    }
});

const welcomeMail = (userAddress, userName) => {
    const mailOptions = {
        from: 'collaclip@hotmail.com',
        to: userAddress,
        subject: 'Welcome to CollaClip!',
        html: `<h1>Hi ${userName}, and welcome to CollaClip!</h1><p>Thank you for choosing to create a clip easily with CollaClip.</p>`
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