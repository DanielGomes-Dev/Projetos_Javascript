module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '4.2.1', // ver versao do db em prod
      skipMD5: true
    },
    autoStart: false,
    instance: {}
  }
}
