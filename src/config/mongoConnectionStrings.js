require('dotenv').config();

const atlasPassword = process.env.ATLAS_PASSWORD;

const local = 'mongodb://127.0.0.1:27017/shared-clip-creator';
const atlas = `mongodb+srv://Eyal:${atlasPassword}@sharedclipcreator.n5xjysp.mongodb.net/?retryWrites=true&w=majority`;

exports.mongoUrl = process.env.RUN_STATUS === "development" ? local : atlas;