const BASE_URL_FRONT = process.env.RUN_STATUS === "development" ? "http://localhost:3000/" : "https://collaclip.herokuapp.com/";

const path = __dirname;
const newPath = path.split("\\");
const index = newPath.findIndex(name => name === 'shared-clip-creator-back');
const rootPath = path.split("\\", index + 1).join("\\");

console.log(rootPath)

module.exports = {
    BASE_URL_FRONT,
    rootPath,
}