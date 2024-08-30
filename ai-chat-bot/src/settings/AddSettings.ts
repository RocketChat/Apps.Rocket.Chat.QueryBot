import {
    ISetting,
    SettingType,
} from "@rocket.chat/apps-engine/definition/settings";

export const settings: ISetting[] = [
    {
        id: "model",
        i18nLabel: "Model selection",
        i18nDescription: "Select the LLM model endpoint you want to use.",
        type: SettingType.SELECT,
        values: [
            { key: "llama3-70b", i18nLabel: "Llama3 70B" },
            { key: "mistral-7b", i18nLabel: "Mistral 7B" },
        ],
        required: true,
        public: true,
        packageValue: "llama3-70b",
    },
    {
        id: "embedding_endpoint",
        i18nLabel: "Embedding Endpoint",
        i18nDescription: "Input the endpoint of the embedding service.",
        type: SettingType.STRING,
        required: true,
        public: true,
        packageValue: "http://text-embedding-api:8020/embed_multiple",
    },
    {
        id: "vector_db_name",
        i18nLabel: "Vector DB Name",
        i18nDescription:
            "Name of the vector database you are using (e.g., Weaviate, Milvus).",
        type: SettingType.STRING,
        required: true,
        public: true,
        packageValue: "Weaviate",
    },
    {
        id: "vector_db_endpoint",
        i18nLabel: "Vector DB Endpoint",
        i18nDescription:
            "Input the endpoint of the vector database (e.g., Weaviate/Milvus).",
        type: SettingType.STRING,
        required: true,
        public: true,
        packageValue: "http://weaviate:8080",
    },
    {
        id: "custom_prompt",
        i18nLabel: "Custom Prompt",
        i18nDescription: "Customize the prompt sent to the LLM for generation.",
        type: SettingType.STRING,
        required: false,
        public: true,
        multiline: true,
        packageValue: "Please summarize the following conversation:",
    },
];