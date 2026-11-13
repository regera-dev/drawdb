import { MemoryRouter } from "react-router-dom";
import ExtensionsContext from "../context/ExtensionsContext";
import SettingsContextProvider from "../context/SettingsContext";
import LayoutContextProvider from "../context/LayoutContext";
import TransformContextProvider from "../context/TransformContext";
import UndoRedoContextProvider from "../context/UndoRedoContext";
import SelectContextProvider from "../context/SelectContext";
import AreasContextProvider from "../context/AreasContext";
import NotesContextProvider from "../context/NotesContext";
import TypesContextProvider from "../context/TypesContext";
import EnumsContextProvider from "../context/EnumsContext";
import ViewsContextProvider from "../context/ViewsContext";
import DiagramContextProvider from "../context/DiagramContext";
import SaveStateContextProvider from "../context/SaveStateContext";

const NO_EXTENSIONS = {};

// drawDB's editor state, as pages/Editor.jsx stacks it. The router is in
// memory: the query string feeds drawDB's layout and theme switches, and no
// navigation inside the editor can move the frame.
export default function OrbitProviders({
  query = "",
  extensions = NO_EXTENSIONS,
  children,
}) {
  return (
    <MemoryRouter initialEntries={[`/?${query}`]}>
      <ExtensionsContext.Provider value={extensions}>
        <SettingsContextProvider>
          <LayoutContextProvider>
            <TransformContextProvider>
              <UndoRedoContextProvider>
                <SelectContextProvider>
                  <AreasContextProvider>
                    <NotesContextProvider>
                      <TypesContextProvider>
                        <EnumsContextProvider>
                          <ViewsContextProvider>
                            <DiagramContextProvider>
                              <SaveStateContextProvider>
                                {children}
                              </SaveStateContextProvider>
                            </DiagramContextProvider>
                          </ViewsContextProvider>
                        </EnumsContextProvider>
                      </TypesContextProvider>
                    </NotesContextProvider>
                  </AreasContextProvider>
                </SelectContextProvider>
              </UndoRedoContextProvider>
            </TransformContextProvider>
          </LayoutContextProvider>
        </SettingsContextProvider>
      </ExtensionsContext.Provider>
    </MemoryRouter>
  );
}
