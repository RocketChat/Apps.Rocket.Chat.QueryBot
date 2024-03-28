from langchain_community.document_loaders import PyPDFLoader
from langchain.document_loaders import WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma
from langchain.llms import HuggingFaceHub
from langchain import hub
from langchain.prompts import PromptTemplate
from langchain.schema.runnable import RunnablePassthrough
import os
from dotenv import load_dotenv

load_dotenv()

class RagService:
    def __init__(self):
        # loader = PyPDFLoader("./giso-schedule-fall2023.pdf")
        loader = WebBaseLoader("https://www.ibm.com/topics/computer-vision")
        token = os.getenv('HUGGINGFACEHUB_API_TOKEN')
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=0)
        splits = text_splitter.split_documents(loader.load())
        
        vectorstore = Chroma.from_documents(documents=splits, embedding=HuggingFaceEmbeddings())
        self.retriever = vectorstore.as_retriever()
        
        repo_id = "mistralai/Mistral-7B-Instruct-v0.2"
        self.llm = HuggingFaceHub(huggingfacehub_api_token=token,  repo_id=repo_id, model_kwargs={"temperature":0.2, "max_new_tokens":200})
        
        self.rag_prompt = hub.pull("rlm/rag-prompt")
    

    def invoke_rag_chain_custom_prompt(self, query: str) -> str:
        template = """
        Use the following pieces of context to answer the question at the end.
        If you don't know the answer, just say that you don't know.
        Always provide the most thorough and detailed answer.
        Always say "thanks for asking!" at the end of the answer.
        {context}
        Question: {question}
        Helpful Answer:"""
        rag_prompt_custom = PromptTemplate.from_template(template)
        
        rag_chain = (
            {"context": self.retriever, "question": RunnablePassthrough()} | 
            rag_prompt_custom | 
            self.llm
        )
        response = rag_chain.invoke(query)

        start = response.find("Question:")
        end = response.find("Thanks for asking!")
        if end != -1:
            return response[start:end + len("Thanks for asking!")]
        else:
            return response[start:]


        
        
