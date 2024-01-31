import {batchImportExportApi} from "../../api/batch-import-export-api";
import {logger} from "../../util/logger";
import {v4 as uuidv4} from "uuid";
import {
    PackageExportTransport,
    PackageKeyAndVersionPair,
    PackageManifestTransport,
    VariableManifestTransport
} from "../../interfaces/package-export-transport";
import {FileService, fileService} from "../file-service";
import {studioService} from "../studio/studio.service";
import {parse, stringify} from "../../util/yaml"
import AdmZip = require("adm-zip");
import * as fs from "fs";
import * as FormData from "form-data";

class BatchImportExportService {

    public async listActivePackages(flavors: string[]): Promise<void> {
        const activePackages = await batchImportExportApi.findAllActivePackages(flavors);
        activePackages.forEach(pkg => {
            logger.info(`${pkg.name} - Key: "${pkg.key}"`)
        });
    }

    public async findAndExportListOfActivePackages(flavors: string[], packageKeys: string[], withDependencies: boolean): Promise<void> {
        let packagesToExport: PackageExportTransport[];

        if (packageKeys.length) {
            packagesToExport = await batchImportExportApi.findActivePackagesByKeys(packageKeys, withDependencies);
        } else  {
            packagesToExport = await batchImportExportApi.findAllActivePackages(flavors, withDependencies);
        }

        packagesToExport = await studioService.getExportPackagesWithStudioData(packagesToExport, withDependencies);

        this.exportListOfPackages(packagesToExport);
    }

    public async batchExportPackages(packageKeys: string[], withDependencies: boolean = false): Promise<void> {
        const exportedPackagesData: Buffer = await batchImportExportApi.exportPackages(packageKeys, withDependencies);
        const exportedPackagesZip: AdmZip = new AdmZip(exportedPackagesData);

        const manifest: PackageManifestTransport[] = parse(
            exportedPackagesZip.getEntry("manifest.yml").getData().toString()
        );

        const versionsByPackageKey = this.getVersionsByPackageKey(manifest);

        let exportedVariables = await this.getVersionedVariablesForPackagesWithKeys(versionsByPackageKey);
        exportedVariables = studioService.fixConnectionVariables(exportedVariables);
        exportedPackagesZip.addFile("variables.yml", Buffer.from(stringify(exportedVariables), "utf8"));

        const studioPackageKeys = manifest.filter(packageManifest => packageManifest.flavor === "STUDIO")
            .map(packageManifest => packageManifest.packageKey);

        const studioData = await studioService.getStudioPackageManifests(studioPackageKeys);
        exportedPackagesZip.addFile("studio.yml", Buffer.from(stringify(studioData), "utf8"));

        exportedPackagesZip.getEntries().forEach(entry => {
            if (entry.name.endsWith(".zip") && studioPackageKeys.includes(entry.name.split("_")[0])) {
                const updatedPackage = studioService.processPackageForExport(entry, exportedVariables);

                exportedPackagesZip.updateFile(entry, updatedPackage.toBuffer());
            }
        });

        const fileDownloadedMessage = "File downloaded successfully. New filename: ";
        const filename = `export_${uuidv4()}.zip`;
        exportedPackagesZip.writeZip(filename);
        logger.info(fileDownloadedMessage + filename);
    }

    public async batchImportPackages(file: string, overwrite: boolean): Promise<void> {
        const configs = new AdmZip(file);

        const formData = this.buildBodyForImport(file, configs);

        const postPackageImportData = await batchImportExportApi.importPackages(formData, overwrite);
        await studioService.processImportedPackages(configs);

        const reportFileName = "config_import_report_" + uuidv4() + ".json";
        fileService.writeToFileWithGivenName(JSON.stringify(postPackageImportData), reportFileName);
        logger.info("Config import report file: " + reportFileName);
    }

    private exportListOfPackages(packages: PackageExportTransport[]): void {
        const filename = uuidv4() + ".json";
        fileService.writeToFileWithGivenName(JSON.stringify(packages), filename);
        logger.info(FileService.fileDownloadedMessage + filename);
    }

    private getVersionsByPackageKey(manifests: PackageManifestTransport[]): Map<string, string[]> {
        const versionsByPackageKey = new Map<string, string[]>();
        manifests.forEach(packageManifest => {
            versionsByPackageKey.set(packageManifest.packageKey, Object.keys(packageManifest.dependenciesByVersion));
        })

        return versionsByPackageKey;
    }

    private getVersionedVariablesForPackagesWithKeys(versionsByPackageKey: Map<string, string[]>): Promise<VariableManifestTransport[]> {
        const variableExportRequest: PackageKeyAndVersionPair[] = [];
        versionsByPackageKey?.forEach((versions, key) => {
            versions?.forEach(version => {
                variableExportRequest.push({
                    packageKey: key,
                    version: version,
                })
            })
        });

        return batchImportExportApi.findVariablesWithValuesByPackageKeysAndVersion(variableExportRequest)
    }

    private buildBodyForImport(file: string, configs: AdmZip): FormData {
        const formData = new FormData();

        formData.append("file", fs.createReadStream(file, {encoding: null}));

        const variablesEntry = configs.getEntry("variables.yml");
        if (variablesEntry) {
            formData.append("mappedVariables", JSON.stringify(parse(variablesEntry.getData().toString())), {
                contentType: "application/json"
            });
        }

        return formData;
    }
}

export const batchImportExportService = new BatchImportExportService();