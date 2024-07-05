import {
    IAppAccessors,
    IHttp,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { notifyMessage } from "./notifyMessage";
import { getEndpoint } from "./endpointsConfig";
import { initializeSettings } from "./settingsInitializer";

export async function createEmbedding(
    text: string,
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp
): Promise<number[]> {
    try {
        const embeddingEndpoint =
            "http://text-embedding-api:8020/embed_multiple";
        const body = JSON.stringify([text]);
        const response = await http.post(embeddingEndpoint, {
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
            },
            content: body,
        });

        if (!response.content) {
            await notifyMessage(
                room,
                read,
                user,
                "Failed to fetch embedding",
                threadId
            );
            throw new Error("Failed to fetch embedding");
        }

        return JSON.parse(response.content).embeddings[0];
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function queryLLM(
    model: string,
    prompt: string,
    userId: string,
    room: IRoom,
    user: IUser,
    threadId: string,
    http: IHttp,
    read: IRead
): Promise<string> {
    try {
        const endpoint = getEndpoint(model);

        const body = {
            model,
            messages: [
                {
                    role: "user",
                    content: prompt,
                    user: userId,
                },
            ],
        };

        const response = await http.post(endpoint + "/chat/completions", {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(body),
        });

        if (!response.content) {
            await notifyMessage(
                room,
                read,
                user,
                "Something is wrong with AI. Please try again later",
                threadId
            );
            throw new Error(
                "Something is wrong with AI. Please try again later"
            );
        }

        return JSON.parse(response.content).choices[0].message.content;
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function queryVectorDB(
    embedding: number[],
    room: IRoom,
    read: IRead,
    user: IUser,
    threadId: string,
    http: IHttp,
    vectorDbEndpoint: string
): Promise<string[]> {
    try {
        const url = `${vectorDbEndpoint}/v1/graphql`;
        const content = {
            query: `{
                Get {
                    RocketChatDocs(
                        nearVector: {
                            vector: ${JSON.stringify(embedding)},
                            distance: 0.6
                        }
                        limit: 5
                    ) {
                        content
                        _additional {
                            certainty
                            distance
                        }
                    }
                }
            }`,
        };

        const response = await http.post(url, {
            headers: {
                "Content-Type": "application/json",
            },
            content: JSON.stringify(content),
        });

        if (!response.content) {
            await notifyMessage(
                room,
                read,
                user,
                "Failed to fetch results from vector DB",
                threadId
            );
            throw new Error("Failed to fetch results from vector DB");
        }

        return JSON.parse(response.content).data.Get.RocketChatDocs.map(
            (result: any) => result.content
        );
    } catch (error) {
        await notifyMessage(
            room,
            read,
            user,
            `Error: ${error.message}`,
            threadId
        );
        throw error;
    }
}

export async function getMessageById(
    read: IRead,
    messageId: string
): Promise<string> {
    const message = await read.getMessageReader().getById(messageId);
    if (!message || !message.text) {
        throw new Error(`Failed to fetch message text with ID ${messageId}`);
    }
    return message.text;
}

export async function initializeLlmService(accessors: IAppAccessors) {
    const settings = await initializeSettings(accessors);

    return {
        settings,
        async queryLLM(
            model: string,
            prompt: string,
            userId: string,
            room: IRoom,
            user: IUser,
            threadId: string,
            http: IHttp,
            read: IRead
        ): Promise<string> {
            return queryLLM(
                model,
                prompt,
                userId,
                room,
                user,
                threadId,
                http,
                read
            );
        },
        async createEmbedding(
            text: string,
            room: IRoom,
            read: IRead,
            user: IUser,
            threadId: string,
            http: IHttp
        ): Promise<number[]> {
            return createEmbedding(text, room, read, user, threadId, http);
        },
        async queryVectorDB(
            embedding: number[],
            room: IRoom,
            read: IRead,
            user: IUser,
            threadId: string,
            http: IHttp,
            vectorDbEndpoint: string
        ): Promise<string[]> {
            return queryVectorDB(
                embedding,
                room,
                read,
                user,
                threadId,
                http,
                vectorDbEndpoint
            );
        },
        async getMessageById(read: IRead, messageId: string): Promise<string> {
            return getMessageById(read, messageId);
        },
    };
}
