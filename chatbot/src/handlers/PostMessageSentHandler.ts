import {
    IModify,
    IRead,
    IHttp,
    IAppAccessors,
    IPersistence,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IJobContext } from "@rocket.chat/apps-engine/definition/scheduler";
import { IPostMessageSent } from "@rocket.chat/apps-engine/definition/messages";
import { initializeLlmService } from "../services/LlmService";

export class PostMessageSentHandler {
    private readonly llmService: any;
    private readonly accessors: IAppAccessors;

    constructor(accessors: IAppAccessors) {
        this.accessors = accessors;
        this.llmService = initializeLlmService(accessors);
    }

    public async processMessageSent(
        jobContext: IJobContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const message = jobContext.message;

        if (message.room.type === "c" && message.text && message.id) {
            const embedding = await this.llmService.createEmbedding(
                message.text
            );
            await this.llmService.storeMessageEmbedding(message.id, embedding);
        } else {
            console.error("Message text or id is undefined.");
        }
    }

    public async execute(
        jobContext: IJobContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        await this.processMessageSent(jobContext, read, modify, http, persis);
    }
}
