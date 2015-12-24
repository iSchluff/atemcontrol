module.exports = function(title){
    return console.log.bind(console, title + ' -');
}
