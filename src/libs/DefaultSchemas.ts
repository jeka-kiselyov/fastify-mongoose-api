import type { TFMASchemas, ajvSchema } from '../types/index.js';

const defaultSchemas = (modelName: string): TFMASchemas => {
    return {
        routeGet: {
            summary: 'Get details of single ' + modelName,
            tags: [modelName],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier of ' + modelName
                    }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    populate: {
                        type: 'string',
                        description: 'Population options of mongoose'
                    }
                }
            },
            response: {
                404: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas404#'
                },
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        },
        routePost: {
            summary: 'Create new ' + modelName,
            tags: [modelName],
            querystring: {
                type: 'object',
                properties: {
                    populate: {
                        type: 'string',
                        description: 'Population options of mongoose'
                    }
                }
            },
            response: {
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        },
        routeList: {
            summary: 'List ' + modelName,
            tags: [modelName],
            querystring: {
                type: 'object',
                properties: {
                    offset: {
                        type: 'number',
                        description: 'Mongoose offset property'
                    },
                    limit: {
                        type: 'number',
                        description: 'Mongoose limit property'
                    },
                    sort: {
                        type: 'string',
                        description: 'Sort options of mongoose'
                    },
                    filter: {
                        type: 'string',
                        description: 'Simple filtering by field value'
                    },
                    where: {
                        type: 'string',
                        description: 'Mongoose where object'
                    },
                    match: {
                        type: 'string',
                        description: 'Use it for pattern matching'
                    },
                    search: {
                        type: 'string',
                        description:
                            'Performs search by full text mongodb indexes'
                    },
                    projection: {
                        type: 'string',
                        description: 'Projection options of mongoose'
                    },
                    populate: {
                        type: 'string',
                        description: 'Population options of mongoose'
                    }
                }
            },
            response: {
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        },
        routePut: {
            summary: 'Replace existing ' + modelName,
            tags: [modelName],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier of ' + modelName
                    }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    populate: {
                        type: 'string',
                        description: 'Population options of mongoose'
                    }
                }
            },
            response: {
                404: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas404#'
                },
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        },
        routePatch: {
            summary: 'Update existing ' + modelName,
            tags: [modelName],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier of ' + modelName
                    }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    populate: {
                        type: 'string',
                        description: 'Population options of mongoose'
                    }
                }
            },
            response: {
                404: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas404#'
                },
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        },
        routeDelete: {
            summary: 'Delete existing ' + modelName,
            tags: [modelName],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier of ' + modelName
                    }
                }
            },
            response: {
                200: {
                    description: 'Success',
                    type: 'object',
                    properties: {
                        acknowledged: { type: 'boolean' },
                        deletedCount: { type: 'number' }
                    }
                },
                404: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas404#'
                },
                500: {
                    type: 'object',
                    $ref: 'MongooseApiDefErrRespSchemas500#'
                }
            }
        }
    };
};

const responseSchema404: ajvSchema = {
    $id: 'MongooseApiDefErrRespSchemas404',
    description: 'Not found',
    type: 'object',
    properties: {
        error: { type: 'string', example: 'Route Not Found' },
        message: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'integer', example: 404 }
    }
};

const responseSchema500: ajvSchema = {
    $id: 'MongooseApiDefErrRespSchemas500',
    description: 'Server error',
    type: 'object',
    properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'integer', example: 500 }
    }
};

export { defaultSchemas, responseSchema404, responseSchema500 };
