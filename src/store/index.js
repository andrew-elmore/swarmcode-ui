import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import agentsReducer from "./agentsSlice";
import articlesReducer from "./articlesSlice";
import authReducer from "./authSlice";
import projectReducer from "./projectSlice";
import commandsReducer from "./commandsSlice";
import messagesReducer from "./messagesSlice";
import projectsReducer from "./projectsSlice";
import ttsReducer from "./ttsSlice";

const store = configureStore({
  reducer: {
    agents: agentsReducer,
    articles: articlesReducer,
    auth: authReducer,
    project: projectReducer,
    commands: commandsReducer,
    messages: messagesReducer,
    projects: projectsReducer,
    tts: ttsReducer,
  },
});

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export default store;
