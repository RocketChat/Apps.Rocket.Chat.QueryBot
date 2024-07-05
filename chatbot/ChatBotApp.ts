import {
    IAppAccessors,
    ILogger,
    IConfigurationExtend,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { AskCommand } from "./src/commands/AskCommand";
import { settings } from "./src//settings/AddSettings";
import { LlmService } from "./src/services/LlmService";
import { PostMessageSentHandler } from "./src/handlers/PostMessageSentHandler";

export class ChatBotApp extends App {
    private llmService: LlmService;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.llmService = new LlmService(accessors);
    }

    protected async extendConfiguration(
        configuration: IConfigurationExtend
    ): Promise<void> {
        await Promise.all([
            ...settings.map((setting) =>
                configuration.settings.provideSetting(setting)
            ),
            configuration.slashCommands.provideSlashCommand(
                new AskCommand(this.llmService)
            ),
        ]);

        configuration.scheduler.registerProcessors([
            {
                id: "postMessageSentHandler",
                processor: async (jobContext, read, modify, http, persis) => {
                    const handler = new PostMessageSentHandler(this.llmService);
                    await handler.execute(
                        jobContext,
                        read,
                        modify,
                        http,
                        persis
                    );
                },
            },
        ]);
    }
}
