const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

module.exports = async (connect, logger = console) => {
    let retryDelay = 2000;

    while (true) {
        try {
            await connect();
            return;
        } catch (error) {
            logger.error(`PostgreSQL connection failed: ${error.message}`);
            logger.error(
                `Retrying in ${retryDelay / 1000}s. Check database status, connection URL, credentials, port, network access, and DB_SSL_CA_FILE.`
            );
            await delay(retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30000);
        }
    }
};
