
const knex              = require('@stopsopa/knex-abstract');

const log               = require('@stopsopa/knex-abstract/log/logn');

const config            = require('./models/config');

knex.init(config);

(async function () {

    const man       = knex().model.common;

    try {

        const databases = await man.query(`show databases`);

        console.log(JSON.stringify(databases, null, 4));

        console.log(`count: ` + databases.length);


    }
    catch (e) {

        log.dump(e, 2);
    }

    man.destroy();
}());

