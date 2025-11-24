const mongoose = require('mongoose');
const Bin = require('../models/Bin');
const ProblemBin = require('../models/ProblemBin');
const FullnessReport = require('../models/FullnessReport');

/**
 * UCLA Facilities Management Integration Module
 * Handles synchronization of bin data with UCLA facilities systems
 */

class FacilitiesIntegration {
  /**
   * Process incoming bin data from UCLA facilities
   * @param {Array} facilityBins - Array of bin objects from facilities management
   * @returns {Object} Processing results
   */
  static async processFacilityData(facilityBins) {
    const results = {
      created: 0,
      updated: 0,
      errors: [],
      processed: []
    };

    for (const facilityBin of facilityBins) {
      try {
        // Validate required fields
        if (!facilityBin.name || !facilityBin.facilityId) {
          results.errors.push({
            bin: facilityBin,
            error: 'Missing required fields (name or facilityId)'
          });
          continue;
        }

        // Find existing bin or create new one
        const existingBin = await Bin.findOne({
          $or: [
            { facilityId: facilityBin.facilityId },
            { qrCode: facilityBin.qrCode }
          ]
        });

        const binData = {
          name: facilityBin.name,
          facilityId: facilityBin.facilityId,
          qrCode: facilityBin.qrCode || `QR-${facilityBin.facilityId}`,
          location: facilityBin.location,
          building: facilityBin.building,
          floor: facilityBin.floor,
          latitude: facilityBin.latitude,
          longitude: facilityBin.longitude,
          streams: facilityBin.streams || ['compost', 'recycle', 'landfill'],
          capacity: facilityBin.capacity,
          type: facilityBin.type || 'standard',
          description: facilityBin.description,
          active: facilityBin.active !== false
        };

        if (existingBin) {
          await Bin.findByIdAndUpdate(existingBin._id, binData);
          results.updated++;
        } else {
          await Bin.create(binData);
          results.created++;
        }

        results.processed.push(facilityBin.facilityId);
      } catch (err) {
        results.errors.push({
          bin: facilityBin,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Sync contamination data from facilities monitoring
   * @param {Array} contaminationData - Array of contamination reports
   */
  static async syncContaminationData(contaminationData) {
    for (const report of contaminationData) {
      try {
        const bin = await Bin.findOne({
          $or: [
            { facilityId: report.facilityId },
            { name: report.binName }
          ]
        });

        if (bin) {
          // Update bin contamination level
          await Bin.findByIdAndUpdate(bin._id, {
            contamination: report.contaminationRate,
            level: report.contaminationRate > 10 ? 'Critical' : 
                   report.contaminationRate > 5 ? 'Warning' : 'Good'
          });

          // Update or create problem bin entry if contamination is high
          if (report.contaminationRate > 5) {
            await ProblemBin.findOneAndUpdate(
              { name: bin.name },
              {
                name: bin.name,
                contamination: report.contaminationRate,
                location: bin.location || bin.building,
                qrCode: bin.qrCode,
                lastUpdated: new Date()
              },
              { upsert: true }
            );
          }
        }
      } catch (err) {
        console.error('Error syncing contamination data:', err);
      }
    }
  }

  /**
   * Calculate and update bin statistics based on reports
   */
  static async updateBinStatistics(binId) {
    try {
      const now = new Date();
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));

      // Get reports for this bin
      const weekReports = await FullnessReport.find({
        station: binId,
        createdAt: { $gte: weekAgo }
      });

      const monthOverflows = await FullnessReport.countDocuments({
        station: binId,
        level: 'Overflowing',
        createdAt: { $gte: monthAgo }
      });

      // Calculate average fullness
      if (weekReports.length > 0) {
        const fullnessMap = {
          'Empty': 0,
          '1/4 Full': 25,
          'Half Full': 50,
          '3/4 Full': 75,
          'Full': 90,
          'Overflowing': 100
        };

        const avgFullness = weekReports.reduce((sum, report) => {
          return sum + (fullnessMap[report.level] || 0);
        }, 0) / weekReports.length;

        // Update problem bin if needed
        const bin = await Bin.findById(binId);
        if (bin && (avgFullness > 80 || monthOverflows > 3)) {
          await ProblemBin.findOneAndUpdate(
            { name: bin.name },
            {
              avgFillLast7Days: Math.round(avgFullness),
              overflowsThisMonth: monthOverflows,
              totalScansToday: weekReports.filter(r => 
                r.createdAt >= new Date(new Date().setHours(0, 0, 0, 0))
              ).length
            },
            { upsert: true }
          );
        }
      }
    } catch (err) {
      console.error('Error updating bin statistics:', err);
    }
  }

  /**
   * Get bins near a specific location
   * @param {Number} latitude - User latitude
   * @param {Number} longitude - User longitude
   * @param {Number} radius - Search radius in meters (default 500m)
   */
  static async getNearbyBins(latitude, longitude, radius = 500) {
    try {
      const bins = await Bin.find({ 
        active: true,
        latitude: { $exists: true },
        longitude: { $exists: true }
      });

      // Calculate distance for each bin
      const binsWithDistance = bins.map(bin => {
        const distance = bin.calculateDistance(latitude, longitude);
        return {
          ...bin.toObject(),
          distance
        };
      });

      // Filter by radius and sort by distance
      return binsWithDistance
        .filter(bin => bin.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    } catch (err) {
      console.error('Error getting nearby bins:', err);
      return [];
    }
  }

  /**
   * Generate facility report for UCLA management
   */
  static async generateFacilityReport(startDate, endDate) {
    try {
      const reports = await FullnessReport.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$station',
            totalReports: { $sum: 1 },
            overflowCount: {
              $sum: { $cond: [{ $eq: ['$level', 'Overflowing'] }, 1, 0] }
            },
            avgFullness: {
              $avg: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$level', 'Empty'] }, then: 0 },
                    { case: { $eq: ['$level', '1/4 Full'] }, then: 25 },
                    { case: { $eq: ['$level', 'Half Full'] }, then: 50 },
                    { case: { $eq: ['$level', '3/4 Full'] }, then: 75 },
                    { case: { $eq: ['$level', 'Full'] }, then: 90 },
                    { case: { $eq: ['$level', 'Overflowing'] }, then: 100 }
                  ],
                  default: 0
                }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'bins',
            localField: '_id',
            foreignField: '_id',
            as: 'binInfo'
          }
        },
        {
          $unwind: {
            path: '$binInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            binName: { $ifNull: ['$binInfo.name', 'Unknown'] },
            facilityId: '$binInfo.facilityId',
            building: '$binInfo.building',
            totalReports: 1,
            overflowCount: 1,
            avgFullness: { $round: ['$avgFullness', 1] },
            needsAttention: {
              $or: [
                { $gte: ['$avgFullness', 80] },
                { $gte: ['$overflowCount', 3] }
              ]
            }
          }
        },
        {
          $sort: { avgFullness: -1 }
        }
      ]);

      return {
        period: { startDate, endDate },
        totalBins: reports.length,
        binsNeedingAttention: reports.filter(r => r.needsAttention).length,
        averageSystemFullness: reports.length > 0 
          ? (reports.reduce((sum, r) => sum + r.avgFullness, 0) / reports.length).toFixed(1)
          : 0,
        totalOverflows: reports.reduce((sum, r) => sum + r.overflowCount, 0),
        details: reports
      };
    } catch (err) {
      console.error('Error generating facility report:', err);
      throw err;
    }
  }
}

module.exports = FacilitiesIntegration;