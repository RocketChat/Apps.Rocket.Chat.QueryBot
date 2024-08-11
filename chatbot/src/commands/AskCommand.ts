import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
    IAppAccessors,
    ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IMessageRaw } from "@rocket.chat/apps-engine/definition/messages";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { initializeLlmService } from "../services/LlmService";
import { notifyMessage } from "../services/notifyMessage";
import { type ChatBotApp } from "../../ChatBotApp";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;
    private readonly llmService: any;

    constructor(accessors: IAppAccessors, private app: ChatBotApp) {
        this.llmService = initializeLlmService(accessors);
    }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        this.app.getLogger().debug("Executing AskCommand");
        const query = context.getArguments().join(" ");
        const room = context.getRoom();
        const userId = context.getSender().id;
        const user = context.getSender();
        const threadId = context.getThreadId();

        const llmService = await this.llmService;

        try {
            await llmService.createSchema(http, this.app.getLogger());
            await notifyMessage(
                room,
                read,
                user,
                "Processing your question...",
                threadId
            );

            await this.processRoomMessages(room, read, http, user, threadId);

            const questionEmbedding = await llmService.createEmbedding(
                query,
                room,
                read,
                user,
                threadId,
                http
            );

            const relevantMessages = await llmService.queryVectorDB(
                questionEmbedding,
                room,
                read,
                user,
                threadId,
                http,
                this.app.getLogger()
            );

            const contextFromDB = this.prepareContext(relevantMessages);

            await notifyMessage(
                room,
                read,
                user,
                `Context from DB: ${contextFromDB}`,
                threadId
            );

            const finalQuery = `Context: ${contextFromDB}\n\nQuestion: ${query}`;
            await notifyMessage(
                room,
                read,
                user,
                `Final Query: ${finalQuery}`,
                threadId
            );

            const response = await llmService.queryLLM(
                finalQuery,
                userId,
                room,
                user,
                threadId,
                http,
                read,
                this.app.getLogger()
            );

            const formattedResponse = this.formatResponse(response);

            await notifyMessage(room, read, user, formattedResponse, threadId);
        } catch (error) {
            this.app.getLogger().error("Error executing ask command");
            this.app.getLogger().error(error);
        }
    }

    private async processRoomMessages(
        room: IRoom,
        read: IRead,
        http: IHttp,
        user: IUser,
        threadId?: string
    ): Promise<void> {
        const messages: IMessageRaw[] = await read
            .getRoomReader()
            .getMessages(room.id, {
                limit: 100,
            });

        const llmService = await this.llmService;

        for (const message of messages) {
            if (message.text) {
                // Create an embedding for each individual message
                const embedding = await llmService.createEmbedding(
                    message.text,
                    room,
                    read,
                    user,
                    threadId,
                    http
                );

                // Store the message text and its embedding in the vector database
                await llmService.storeChatBotDoc(
                    message.text,
                    embedding,
                    room,
                    read,
                    user,
                    threadId,
                    http,
                    this.app.getLogger()
                );

                this.app
                    .getLogger()
                    .debug(
                        `Stored message: "${message.text}" with embedding length: ${embedding.length}`
                    );
            }
        }
    }

    private prepareContext(messages: string[]): string {
        return messages.slice(0, 5).join("\n\n");
    }

    private formatResponse(response: string): string {
        return `Answer: ${response}`;
    }
}
