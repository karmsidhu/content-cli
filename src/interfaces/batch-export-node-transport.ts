import {
    ContentNodeTransport, DataModelTransport,
    PackageDependencyTransport,
    PackageHistoryTransport, StudioDataModelTransport, VariablesAssignments
} from "./package-manager.interfaces";
import {SpaceTransport} from "./save-space.interface";

export interface BatchExportNodeTransport extends ContentNodeTransport {
    workingDraftId: string;
    activatedDraftId: string;
    version?: PackageHistoryTransport;
    dependencies?: PackageDependencyTransport[];
    datamodels?: StudioDataModelTransport[];
    variables?: VariablesAssignments[];
    space?: SpaceTransport;
}

export interface PackageAndAssetTransport {
    rootNode: ContentNodeTransport,
    nodes: ContentNodeTransport[]
}

export interface SpaceMappingTransport {
    packageKey: string,
    spaceId: string
}