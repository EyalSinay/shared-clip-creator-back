const getSectionMessage = (varsArr, projectMessage, secName, secLink) => {
    if(varsArr === undefined || projectMessage === undefined || secName === undefined || secLink === undefined) return;
    const newVarsArr = [...varsArr];
    newVarsArr.push({key: 'NAME', value: secName}, {key: 'LINK', value: secLink});

    const getNewString = (variable, string) => string.replaceAll("▷" + variable.key + "◁", variable.value);

    let newStr = projectMessage.message;
    let newArr = projectMessage.paragraphsArr;

    newVarsArr.forEach(variable => {
        newStr = getNewString(variable, newStr);
        newArr = newArr.map(secMessage => getNewString(variable, secMessage));
    });

    return {
        message: newStr,
        paragraphsArr: newArr
    }
}

exports.getSectionMessage = getSectionMessage;