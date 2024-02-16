import type {
    TFMAPluginOptions,
    TFMAApiOptions,
    TFMAPluginAsync
} from './types.js';
import type { FastifyInstance } from 'fastify';
import API from './libs/API.js';
import DefaultModelMethods from './libs/DefaultModelMethods.js';
import fp from 'fastify-plugin';

const initPlugin: TFMAPluginAsync<TFMAPluginOptions> = async (
    fastify: FastifyInstance,
    options: TFMAPluginOptions
) => {
    options = options || {};

    const apiOptions: TFMAApiOptions = {
        ...options,
        fastify
    };

    const api = new API(apiOptions);
    fastify.decorate('mongooseAPI', api);
};

const plugin = fp(initPlugin, {
    fastify: '^2.0.0 || ^3.0.0 || ^4.0.0',
    name: 'fastify-mongoose-api'
});

plugin.DefaultModelMethods = DefaultModelMethods;

export default plugin;
