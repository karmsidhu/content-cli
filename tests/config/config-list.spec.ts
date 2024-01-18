import {PackageExportTransport} from "../../src/interfaces/package-export-transport";
import {ConfigCommand} from "../../src/commands/config.command";
import {mockWriteFileSync, testTransport} from "../jest.setup";
import {
    ContentNodeTransport,
    PackageWithVariableAssignments,
    StudioComputeNodeDescriptor
} from "../../src/interfaces/package-manager.interfaces";
import * as path from "path";
import {FileService} from "../../src/services/file-service";
import {mockAxiosGet} from "../utls/http-requests-mock";
import {PackageManagerApiUtils} from "../utls/package-manager-api.utils";

describe("Config list", () => {

    it.each([
        "",
        "STUDIO,TEST"
    ])(
        "Should list all packages by key for non-json response with flavors: %p",
        async (flavors: string) => {
            const firstPackage = PackageManagerApiUtils.buildPackageExportTransport("key-1", "name-1");
            const secondPackage = PackageManagerApiUtils.buildPackageExportTransport("key-2", "name-2");

            const flavorsArray = flavors !== "" ? flavors.split(",") : [];

            const urlParams = new URLSearchParams();
            urlParams.set("withDependencies", "false");
            flavorsArray.forEach(flavor => urlParams.append("flavors", flavor));

            mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/core/packages/export/list?" + urlParams.toString(), [firstPackage, secondPackage]);

            await new ConfigCommand().listActivePackages(false, flavorsArray, false, []);

            expect(testTransport.logMessages.length).toBe(2);
            expect(testTransport.logMessages[0].message).toContain(`${firstPackage.name} - Key: "${firstPackage.key}"`);
            expect(testTransport.logMessages[1].message).toContain(`${secondPackage.name} - Key: "${secondPackage.key}"`);
        }
    )

    it("Should export all packages for json response with spaceId set for studio packages", async () => {
        const firstPackage = PackageManagerApiUtils.buildPackageExportTransport("key-1", "name-1");
        const secondPackage = PackageManagerApiUtils.buildPackageExportTransport("key-2", "name-2");

        const studioPackage: ContentNodeTransport = PackageManagerApiUtils.buildContentNodeTransport("key-1", "spaceId-1");

        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/core/packages/export/list?withDependencies=false", [{...firstPackage}, {...secondPackage}]);
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", [studioPackage]);

        await new ConfigCommand().listActivePackages(true, [], false, []);

        const expectedFileName = testTransport.logMessages[0].message.split(FileService.fileDownloadedMessage)[1];

        expect(mockWriteFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), expectedFileName), expect.any(String), {encoding: "utf-8"});

        const exportedTransports = JSON.parse(mockWriteFileSync.mock.calls[0][1]) as PackageExportTransport[];
        expect(exportedTransports.length).toBe(2);

        const exportedFirstPackage = exportedTransports.filter(transport => transport.key === firstPackage.key)[0];
        const exportedSecondPackage = exportedTransports.filter(transport => transport.key === secondPackage.key)[0];

        expect(exportedSecondPackage).toEqual(secondPackage);
        expect(exportedFirstPackage).toEqual({...firstPackage, spaceId: "spaceId-1"});
    })

    it("Should export all packages with dependencies and data models set for json response and withDependencies option", async () => {
        const firstPackage = PackageManagerApiUtils.buildPackageExportTransport("key-1", "name-1");
        const secondPackage = PackageManagerApiUtils.buildPackageExportTransport("key-2", "name-2");

        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/core/packages/export/list?withDependencies=true", [{...firstPackage}, {...secondPackage}]);
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", []);

        const dataModelVariableAssignmentResponse: PackageWithVariableAssignments = {
            id: "var-id",
            key: firstPackage.key,
            name: "var-name",
            createdBy: "",
            spaceId: undefined,
            variableAssignments: [
                {
                    key: "var-key",
                    value: "datamodel-id" as unknown as object,
                    type: "DATA_MODEL"
                }
            ]
        };
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", [dataModelVariableAssignmentResponse]);

        const dataModelDetailResponse: StudioComputeNodeDescriptor = {
            name: "pool-name",
            dataModelId: "datamodel-id",
            poolId: "pool-id"
        };
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/compute-pools/data-models/details", [dataModelDetailResponse]);

        await new ConfigCommand().listActivePackages(true, [], true, []);

        const expectedFileName = testTransport.logMessages[0].message.split(FileService.fileDownloadedMessage)[1];

        expect(mockWriteFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), expectedFileName), expect.any(String), {encoding: "utf-8"});

        const exportedTransports = JSON.parse(mockWriteFileSync.mock.calls[0][1]) as PackageExportTransport[];
        expect(exportedTransports.length).toBe(2);

        const exportedFirstPackage = exportedTransports.filter(transport => transport.key === firstPackage.key)[0];
        const exportedSecondPackage = exportedTransports.filter(transport => transport.key === secondPackage.key)[0];

        expect(exportedSecondPackage).toEqual(secondPackage);
        expect(exportedFirstPackage).toEqual({...firstPackage, datamodels: [{...dataModelDetailResponse}]});
    })

    it("Should export packagesByKeys with spaceId set for studio packages", async () => {
        const firstPackage = PackageManagerApiUtils.buildPackageExportTransport("key-1", "name-1");
        const secondPackage = PackageManagerApiUtils.buildPackageExportTransport("key-2", "name-2");

        const studioPackage: ContentNodeTransport = PackageManagerApiUtils.buildContentNodeTransport("key-1", "spaceId-1");

        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/core/packages/export/list-by-keys?packageKeys=key-1&packageKeys=key-2&withDependencies=false", [{...firstPackage}, {...secondPackage}]);
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", [studioPackage]);

        await new ConfigCommand().listActivePackages(true, [], false, [firstPackage.key, secondPackage.key]);

        const expectedFileName = testTransport.logMessages[0].message.split(FileService.fileDownloadedMessage)[1];

        expect(mockWriteFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), expectedFileName), expect.any(String), {encoding: "utf-8"});

        const exportedTransports = JSON.parse(mockWriteFileSync.mock.calls[0][1]) as PackageExportTransport[];
        expect(exportedTransports.length).toBe(2);

        const exportedFirstPackage = exportedTransports.filter(transport => transport.key === firstPackage.key)[0];
        const exportedSecondPackage = exportedTransports.filter(transport => transport.key === secondPackage.key)[0];

        expect(exportedSecondPackage).toEqual(secondPackage);
        expect(exportedFirstPackage).toEqual({...firstPackage, spaceId: "spaceId-1"});
    })

    it("Should export packagesByKeys with dependencies and data models set for withDependencies option", async () => {
        const firstPackage = PackageManagerApiUtils.buildPackageExportTransport("key-1", "name-1");
        const secondPackage = PackageManagerApiUtils.buildPackageExportTransport("key-2", "name-2");

        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/core/packages/export/list-by-keys?packageKeys=key-1&packageKeys=key-2&withDependencies=true", [{...firstPackage}, {...secondPackage}]);
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", []);

        const dataModelVariableAssignmentResponse: PackageWithVariableAssignments = {
            id: "var-id",
            key: firstPackage.key,
            name: "var-name",
            createdBy: "",
            spaceId: undefined,
            variableAssignments: [
                {
                    key: "var-key",
                    value: "datamodel-id" as unknown as object,
                    type: "DATA_MODEL"
                }
            ]
        };
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/packages/with-variable-assignments?type=DATA_MODEL", [dataModelVariableAssignmentResponse]);

        const dataModelDetailResponse: StudioComputeNodeDescriptor = {
            name: "pool-name",
            dataModelId: "datamodel-id",
            poolId: "pool-id"
        };
        mockAxiosGet("https://myTeam.celonis.cloud/package-manager/api/compute-pools/data-models/details", [dataModelDetailResponse]);

        await new ConfigCommand().listActivePackages(true, [], true, [firstPackage.key, secondPackage.key]);

        const expectedFileName = testTransport.logMessages[0].message.split(FileService.fileDownloadedMessage)[1];

        expect(mockWriteFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), expectedFileName), expect.any(String), {encoding: "utf-8"});

        const exportedTransports = JSON.parse(mockWriteFileSync.mock.calls[0][1]) as PackageExportTransport[];
        expect(exportedTransports.length).toBe(2);

        const exportedFirstPackage = exportedTransports.filter(transport => transport.key === firstPackage.key)[0];
        const exportedSecondPackage = exportedTransports.filter(transport => transport.key === secondPackage.key)[0];

        expect(exportedSecondPackage).toEqual(secondPackage);
        expect(exportedFirstPackage).toEqual({...firstPackage, datamodels: [{...dataModelDetailResponse}]});
    })
})