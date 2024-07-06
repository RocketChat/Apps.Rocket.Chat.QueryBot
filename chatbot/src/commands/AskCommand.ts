import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
    IAppAccessors,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { initializeLlmService } from "../services/LlmService";
import { notifyMessage } from "../services/notifyMessage";

export class AskCommand implements ISlashCommand {
    public command = "ask";
    public i18nDescription = "Ask a question to the LLM";
    public i18nParamsExample = "Your question";
    public providesPreview = false;
    private readonly llmService: any;

    constructor(accessors: IAppAccessors) {
        this.llmService = initializeLlmService(accessors);
    }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const query = context.getArguments().join(" ");
        const room = context.getRoom();
        const userId = context.getSender().id;
        const user = context.getSender();
        const threadId = context.getThreadId();

        const llmService = await this.llmService;

        try {
            await this.sendMessage(
                modify,
                room,
                "Processing your question...",
                threadId
            );

            const contextText = threadId
                ? await this.getThreadMessages(room, read, user, threadId)
                : await this.getFallbackContext(room, read, user);

            await notifyMessage(
                room,
                read,
                user,
                `Context Text: ${contextText}`,
                threadId
            );

            const combinedQuery = `Context: ${contextText}\n\nQuestion: ${query}`;
            await notifyMessage(
                room,
                read,
                user,
                `Combined Query: ${combinedQuery}`,
                threadId
            );

            const response = await llmService.queryLLM(
                combinedQuery,
                userId,
                room,
                user,
                threadId,
                http,
                read
            );

            await notifyMessage(
                room,
                read,
                user,
                `LLM Response: ${response}`,
                threadId
            );

            const formattedResponse = this.formatResponse(response);

            await this.sendMessage(modify, room, formattedResponse, threadId);
        } catch (error) {
            console.error(`Error executing ask command: ${error.message}`);
            console.error(`Error stack: ${error.stack}`);
            await this.sendErrorMessage(modify, room, error.message, threadId);
        }
    }

    private async getThreadMessages(
        room: IRoom,
        read: IRead,
        user: IUser,
        threadId: string
    ): Promise<string> {
        const threadReader = read.getThreadReader();
        const thread = await threadReader.getThreadById(threadId);

        if (!thread) {
            await notifyMessage(room, read, user, "Thread not found");
            throw new Error("Thread not found");
        }

        const messageTexts: string[] = [];
        for (const message of thread) {
            if (message.text) {
                messageTexts.push(`${message.sender.name}: ${message.text}`);
            }
        }

        messageTexts.shift();

        for (const messageText of messageTexts) {
            await notifyMessage(room, read, user, messageText);
        }

        return messageTexts.join("\n");
    }

    private async getFallbackContext(
        room: IRoom,
        read: IRead,
        user: IUser
    ): Promise<string> {
        const fallbackMessage =
            "No threadId provided and no fallback context implemented.";
        await notifyMessage(room, read, user, fallbackMessage);
        return fallbackMessage;
    }

    private formatResponse(response: string): string {
        return `Answer: ${response}`;
    }

    private async sendMessage(
        modify: IModify,
        room: any,
        text: string,
        threadId?: string
    ): Promise<void> {
        const builder = modify
            .getCreator()
            .startMessage()
            .setRoom(room)
            .setText(text);

        if (threadId) {
            builder.setThreadId(threadId);
        }

        await modify.getCreator().finish(builder);
    }

    private async sendErrorMessage(
        modify: IModify,
        room: any,
        errorMessage: string,
        threadId?: string
    ): Promise<void> {
        await this.sendMessage(
            modify,
            room,
            `Error: ${errorMessage}`,
            threadId
        );
    }
}
