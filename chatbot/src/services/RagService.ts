import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { SlashCommandContext } from "@rocket.chat/apps-engine/definition/slashcommands";

export class RagService {
    constructor(
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly http: IHttp,
        private readonly persis: IPersistence
    ) {}

    public async handleQuery(
        context: SlashCommandContext,
        query: string
    ): Promise<void> {
        try {
            const aiResponse = await this.getRagResponse(query);
            await this.sendMessage(context, aiResponse);
        } catch (error) {
            console.error("Error handling query with RAG pipeline:", error);
            await this.sendMessage(
                context,
                "Sorry, there was an error processing your query."
            );
        }
    }

    private async getRagResponse(query: string): Promise<string> {
        const apiUrl = "http://127.0.0.1:8000/query";

        const response = await this.http.post(apiUrl, {
            data: { query: query },
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (response.statusCode === 200 && response.data) {
            return response.data.response;
        } else {
            throw new Error(
                `Failed to get response from RAG API: ${response.statusCode}`
            );
        }
    }

    private async sendMessage(
        context: SlashCommandContext,
        text: string
    ): Promise<void> {
        const builder = this.modify
            .getCreator()
            .startMessage()
            .setSender(context.getSender())
            .setRoom(context.getRoom())
            .setText(text);

        await this.modify.getCreator().finish(builder);
    }
}
