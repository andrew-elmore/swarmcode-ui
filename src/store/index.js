import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import agentsReducer from "./agentsSlice";
import boardReducer from "./boardSlice";
import messagesReducer from "./messagesSlice";
import projectsReducer from "./projectsSlice";

const store = configureStore({
  reducer: {
    agents: agentsReducer,
    board: boardReducer,
    messages: messagesReducer,
    projects: projectsReducer,
  },
});

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export default store;
