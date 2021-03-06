
const knex          = require('@stopsopa/knex-abstract');

const log           = require('inspc');

const validator     = require('@stopsopa/validator');

const trim          = require('nlab/trim');

const querystring   = require('querystring');

const jwt           = require('jsonwebtoken');

const config        = require('../config');

const isObject      = require('nlab/isObject');

module.exports = app => {

    /**
fetch('/register?x-jwt=...', {

// you might identify node in cluster to edit by id or just by pair of values (cluster & node)
fetch('/register', {
	method: 'post',
	headers: {
		'Content-type': 'application/json; charset=utf-8',
    },
	body: JSON.stringify({
		cluster: 'cluster1',
		node: 'ddd',
		domain: 'http://dom66',
		port: '90',
		// id: 19
	})
}).then(res => res.json()).then(data => console.log('end', data))
     */
    app.post('/register', async (req, res) => {

        // loggin to cli vvv
        process.stdout.write(
            (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
            ': ' + req.method.toUpperCase().padEnd(4, ' ') +
            ":" +
            req.url.split('?')[0] +
            "\n"
        );

        req.clilogged = true;
        // loggin to cli ^^^

        if ( ! req.auth ) {

            log("no access 1\n");

            return res.accessDenied(req);
        }

        let entity              = req.body;

        const man               = knex().model.clusters;

        if ( ! entity.id && entity.cluster && typeof entity.node !== 'undefined' ) {

            const {
                cluster,
                node,
            } = entity;

            const cond = (node === null) ? 'is' : '=';

            let found;

            try {

                found = await man.queryOne(`select id from :table: where cluster = :cluster and node ${cond} :node`, {
                    cluster,
                    node,
                });
            }
            catch (e) {

                log.dump(e);

                return res.jsonError(`Database sql error: couldn't find the node by cluster: '${cluster}' & node: '${node}'`);
            }

            if (found) {

                entity.id = found.id;
            }
        }

        let id                  = entity.id;

        const mode              = id ? 'edit' : 'create';

        const validators        = man.getValidators(mode, id, entity);

        if (mode === 'create') {

            entity = {
                ...man.initial(),
                ...entity,
            };
        }

        const entityPrepared    = man.prepareToValidate(entity, mode);

        const errors            = await validator(entityPrepared, validators);

        if ( ! errors.count() ) {

            try {

                if (mode === 'edit') {

                    await man.update(entityPrepared, id);
                }
                else {

                    id = await man.insert(entityPrepared);
                }

                entity = await man.find(id);

                if ( ! entity ) {

                    return res.jsonError("Database state conflict: updated/created entity doesn't exist");
                }
            }
            catch (e) {

                log.dump(e);

                return res.jsonError(`Can't register: ` + JSON.stringify(req.body) + ', reason: ' + e.e);
            }
        }

        return res.jsonNoCache({
            entity: entity,
            errors: errors.getTree(),
        });

    });
    app.all('/remove/:id?', async (req, res) => {

        if ( ! req.auth ) {

            log("no access 2\n");

            return res.accessDenied(req);
        }

        let id              = req.params.id;

        let entity          = req.body || {};

        const man               = knex().model.clusters;

        if ( ! id && entity.cluster && typeof entity.node !== 'undefined' ) {

            const {
                cluster,
                node,
            } = entity;

            const cond = (node === null) ? 'is' : '=';

            let found;

            try {

                found = await man.queryOne(`select id from :table: where cluster = :cluster and node ${cond} :node`, {
                    cluster,
                    node,
                });
            }
            catch (e) {

                log.dump(e);

                return res.jsonError(`Database sql error: couldn't find the node by cluster: '${cluster}' & node: '${node}'`);
            }

            if (found) {

                id = found.id;
            }
        }

        if ( ! id ) {

            return res.jsonError(`it's necessary to give id in url or cluster and node in json body`);
        }

        let affected;

        try {

            affected = await man.delete(id);
        }
        catch (e) {

            log.dump(e);

            return res.jsonError(`Database sql error: Can't delete node by id: '${id}'`);
        }

        return res.jsonNoCache({
            affected,
        });
    });

    let i = 0;

    const send = ({
        domain,
        port,
    }, path, data) => {

        let url = domain;

        if (port != 80) {

            url += ':' + port;
        }

        url += path;

        let tmp;

        return fetch(url, {
            method: 'post',
            headers: {
                'Content-type': 'application/json; charset=utf-8',
                'x-mediator': 'true',
            },
            body: JSON.stringify(data)
        }).then(res => {
            tmp = res;
            return res.json();
        }).then(
            d => ({then: d}),
            e => {

                const resp = {catch: e};

                tmp && (resp.res = {
                    status: tmp.status,
                    url: tmp.url,
                    statusText: tmp.statusText,
                    headers: (function (){
                        try {
                            return tmp.headers._headers;
                        }
                        catch (e) {

                            return `can't extract`;
                        }
                    }()),
                });

                return resp;
            }
        );
    }
    /**
fetch('/many/root/test?x-jwt=...', {


fetch('/many/root/test', {
    method: 'post',
    headers: {
        'Content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({data:'value'})
}).then(res => res.json()).then(data => console.log('end', data))
     */
    app.post('/many/:cluster/:path(*)', async (req, res) => {

        // loggin to cli vvv
        process.stdout.write(
            (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
            ': ' + req.method.toUpperCase().padEnd(4, ' ') +
            ":" +
            req.url.split('?')[0] +
            "\n"
        );

        req.clilogged = true;
        // loggin to cli ^^^

        if ( ! req.auth ) {

            log("no access 3\n");

            return res.accessDenied(req);
        }

        try {

            let {
                cluster,
                path,
            } = req.params;

            path = trim(path, '/');

            path = '/' + path;

            let query = querystring.stringify(req.query);

            if (query) {

                path += '?' + query;
            }

            const found = await knex().model.clusters.findClusters({
                cluster,
            });

            if ( ! found.length ) {

                return res.jsonError(`cluster not found`);
            }

            try {

                const data = await Promise.all(found.map(d => send(d, path, req.body)))

                return res.jsonNoCache(data);
            }
            catch (e) {

                return res.jsonError(e + '');
            }
        }
        catch (e) {

            log.dump(e);

            return res.jsonError(`Can't many proxy`);
        }
    });
    /**
fetch('/one/root/dd/test', {
	method: 'post',
	headers: {
		'Content-type': 'application/json; charset=utf-8',
    },
	body: JSON.stringify({data:'value'})
}).then(res => res.json()).then(data => console.log('end', data))
     */
    app.post('/one/:cluster/:node(([^\\/]+)|)/:path(*)?', async (req, res) => {

        // loggin to cli vvv
            const {
                cluster,
                node = '[null]',
            } = req.params || {};

            const {
                fromCluster,
                fromNode = '[null]',
            } = req.body || {};

            process.stdout.write(
                (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
                `: from: cluster(${fromCluster}) node(${fromNode}) to: cluster(${cluster}) node(${node}) ` +
                req.method.toUpperCase().padEnd(4, ' ') +
                ":" +
                req.url.split('?')[0] +
                "\n"
            );

            req.clilogged = true;
        // loggin to cli ^^^

        if ( ! req.auth ) {

            log("no access 4\n");

            return res.accessDenied(req);
        }

        try {

            let {
                cluster,
                node,
                path,
            } = req.params;

            path = trim(path || '', '/');

            path = '/' + path;

            let query = querystring.stringify(req.query);

            if (query) {

                path += '?' + query;
            }

            if (typeof node === 'undefined') {

                node = null;
            }

            const found = await knex().model.clusters.findClusters({
                cluster,
                node,
            });

            if ( ! found.length ) {

                return res.jsonError(`clusters not found`);
            }

            try {

                const data = await send(found.shift(), path, req.body);

                if (data.then) {

                    return res.jsonNoCache(data.then);
                }

                return res.jsonError(data.catch);
            }
            catch (e) {

                return res.jsonError(e + '');
            }
        }
        catch (e) {

            log.dump(e);

            return res.jsonError(`Can't one proxy`);
        }
    });

    app.all('/admin/clusters/:cluster?', async (req, res) => {

        // loggin to cli vvv
        process.stdout.write(
            (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
            ': ' + req.method.toUpperCase().padEnd(4, ' ') +
            ":" +
            req.url.split('?')[0] +
            "\n"
        );

        req.clilogged = true;
        // loggin to cli ^^^

        if ( ! req.auth ) {

            log("no access 5\n");

            return res.accessDenied(req);
        }

        const cluster = (req.params.cluster || "").trim();

        try {

            let query       = 'select * from :table:';

            const params    = {};

            if (cluster) {

                query += ' where cluster = :cluster';

                params.cluster = cluster;
            }

            const list = await knex().model.clusters.query(query, params);

            return res.jsonNoCache({
                list,
            });
        }
        catch (e) {

            log.dump(e);

            return res.jsonError(`Can't one proxy`);
        }
    })

    app.all('/admin/cluster/:id?', async (req, res) => {

        // loggin to cli vvv
        process.stdout.write(
            (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
            ': ' + req.method.toUpperCase().padEnd(4, ' ') +
            ":" +
            req.url.split('?')[0] +
            "\n"
        );

        req.clilogged = true;
        // loggin to cli ^^^

        if ( ! req.auth ) {

            log("no access 6\n");

            return res.accessDenied(req);
        }

        const id = req.params.id;

        try {

            const entity = await knex().model.clusters.find(id);

            if ( ! entity ) {

                return res.notFound(`Cluster not found by id: '${id}'`)
            }

            return res.jsonNoCache({
                entity,
            });
        }
        catch (e) {

            log.dump(e);

            return res.jsonError(`Can't one proxy`);
        }
    });

    app.all('/token', (req, res) => {

        // loggin to cli vvv
            process.stdout.write(
                (new Date()).toISOString().substring(0, 19).replace('T', ' ') +
                ': ' + req.method.toUpperCase().padEnd(4, ' ') +
                ":" +
                req.url.split('?')[0] +
                "\n"
            );

            req.clilogged = true;
        // loggin to cli ^^^

        if ( ! isObject(req.auth) ) {

            log("no access 7\n");

            log.dump(req.auth, 4)

            return res.accessDenied(req);
        }

        // to create use:
        const token = jwt.sign(
            {},
            process.env.PROTECTED_BASIC_AND_JWT,
            {
                // https://github.com/auth0/node-jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback
                // must be int
                expiresIn: parseInt(config.jwt.jwt_expire, 10)
            }
        )

        let verified = false;

        try {

            // expecting exception from method .verify() if not valid:
            // https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback
            jwt.verify(token, process.env.PROTECTED_BASIC_AND_JWT);

            verified = true;
        }
        catch (e) { // auth based on cookie failed (any reason)


            log.t(`api: req: '${req.url}', invalid jwt token: '${e}'`);
        }

        return res.jsonNoCache({
            token,
            verified,
            exp: config.jwt.jwt_expire,
        })
    });
}